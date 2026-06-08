# Error Model Reference

Conventions for raising, propagating, and translating errors in a Spring WebFlux hexagonal project.

---

## Table of Contents
1. [Exception Hierarchy](#1-exception-hierarchy)
2. [Raising Errors in the Domain](#2-raising-errors-in-the-domain)
3. [Operator-Level Error Handling](#3-operator-level-error-handling)
4. [Global Handler — Annotated (@ControllerAdvice)](#4-global-handler--annotated)
5. [Global Handler — Functional Equivalent](#5-global-handler--functional-equivalent)
6. [HTTP Error Response Shape](#6-http-error-response-shape)
7. [Mapping External Errors to Domain Errors](#7-mapping-external-errors-to-domain-errors)
8. [Error Propagation Rules](#8-error-propagation-rules)

---

## 1. Exception Hierarchy

```
DomainException (abstract, framework-free)
├── NotFoundException        → HTTP 404
├── ValidationException      → HTTP 422
├── ConflictException        → HTTP 409
└── ExternalServiceException → HTTP 502 (raised by outbound adapters)
```

```java
// domain/exception/DomainException.java
public abstract class DomainException extends RuntimeException {
    protected DomainException(String message) { super(message); }
    protected DomainException(String message, Throwable cause) { super(message, cause); }
}

// domain/exception/NotFoundException.java
public abstract class NotFoundException extends DomainException {
    protected NotFoundException(String message) { super(message); }
}

// domain/exception/OrderNotFoundException.java
public class OrderNotFoundException extends NotFoundException {
    public OrderNotFoundException(OrderId id) {
        super("Order not found: " + id.value());
    }
}

// domain/exception/ValidationException.java
public class ValidationException extends DomainException {
    public ValidationException(String message) { super(message); }
}

// domain/exception/ConflictException.java
public class ConflictException extends DomainException {
    public ConflictException(String message) { super(message); }
}

// domain/exception/ExternalServiceException.java
// Raised by outbound adapters when an external call fails — still extends DomainException
// so it flows through the same global handler.
public class ExternalServiceException extends DomainException {
    public ExternalServiceException(String message, Throwable cause) {
        super(message, cause);
    }
}
```

---

## 2. Raising Errors in the Domain

Domain and application services raise errors via `Mono.error()` — never via `throw` inside a
`flatMap`/`map` operator (which would work, but is less explicit and harder to test).

```java
// Preferred: Mono.error inside reactive chain
return orderRepository.findById(id)
    .switchIfEmpty(Mono.error(new OrderNotFoundException(id)));

// For conditional validation
return Mono.just(command)
    .flatMap(cmd -> cmd.items().isEmpty()
        ? Mono.error(new ValidationException("Order must contain at least one item"))
        : Mono.just(cmd))
    .flatMap(this::doCreate);

// Acceptable: throw in a non-operator context (e.g., domain object constructor)
public record OrderId(String value) {
    public OrderId {
        if (value == null || value.isBlank())
            throw new ValidationException("OrderId must not be blank");
    }
}
// The thrown exception will be caught by the reactive runtime and
// converted to an error signal automatically when inside a Mono.defer() or flatMap().
```

---

## 3. Operator-Level Error Handling

```java
// onErrorMap — translate one exception type to another
return externalClient.post(request)
    .onErrorMap(WebClientResponseException.NotFound.class,
        ex -> new OrderNotFoundException(id))
    .onErrorMap(WebClientResponseException.class,
        ex -> new ExternalServiceException("Remote error: " + ex.getStatusCode(), ex))
    .onErrorMap(WebClientException.class,
        ex -> new ExternalServiceException("Service unreachable", ex));

// onErrorResume — provide a fallback value (use sparingly — don't swallow real errors)
return cacheGateway.find(key)
    .onErrorResume(CacheException.class, ex -> {
        log.warn("Cache miss due to error, falling back to DB: {}", ex.getMessage());
        return dbRepository.findById(key);
    });

// doOnError — side-effects (logging) without changing the error signal
return service.process(command)
    .doOnError(ex -> log.error("Processing failed for command {}", command.id(), ex));

// retryWhen — retry on transient failures (use with care; idempotency must be guaranteed)
return inventoryGateway.reserve(productId, qty)
    .retryWhen(Retry.backoff(3, Duration.ofMillis(200))
        .filter(ex -> ex instanceof ExternalServiceException));
```

---

## 4. Global Handler — Annotated

The `@RestControllerAdvice` handler lives in `adapter/in/web/`. It translates domain exceptions to
HTTP responses. **Never** reference Spring types in the domain exception classes themselves.

```java
// adapter/in/web/GlobalExceptionHandler.java
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    // 404 — any NotFoundException subtype
    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(NotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(ErrorResponse.of("NOT_FOUND", ex.getMessage()));
    }

    // 422 — domain/request validation failure
    @ExceptionHandler(ValidationException.class)
    public ResponseEntity<ErrorResponse> handleValidation(ValidationException ex) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
            .body(ErrorResponse.of("VALIDATION_ERROR", ex.getMessage()));
    }

    // 422 — @Valid binding failure (WebFlux)
    @ExceptionHandler(WebExchangeBindException.class)
    public ResponseEntity<ErrorResponse> handleBindException(WebExchangeBindException ex) {
        String detail = ex.getBindingResult().getFieldErrors().stream()
            .map(e -> e.getField() + " " + e.getDefaultMessage())
            .collect(Collectors.joining("; "));
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
            .body(ErrorResponse.of("VALIDATION_ERROR", detail));
    }

    // 409 — conflict
    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ErrorResponse> handleConflict(ConflictException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(ErrorResponse.of("CONFLICT", ex.getMessage()));
    }

    // 502 — external service failures
    @ExceptionHandler(ExternalServiceException.class)
    public ResponseEntity<ErrorResponse> handleExternalService(ExternalServiceException ex) {
        log.error("External service error", ex);
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
            .body(ErrorResponse.of("EXTERNAL_SERVICE_ERROR", "A downstream service failed"));
    }

    // 500 — catch-all (never expose internals)
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneric(Exception ex) {
        log.error("Unhandled exception", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(ErrorResponse.of("INTERNAL_ERROR", "An unexpected error occurred"));
    }
}
```

---

## 5. Global Handler — Functional Equivalent

Use this when the endpoint layer is built with `RouterFunction` / handler functions instead of
`@RestController`. Implement `WebExceptionHandler` with `@Order(-2)` to run before Spring Boot's
default handler.

```java
// adapter/in/web/GlobalWebExceptionHandler.java
@Component
@Order(-2)   // must run before DefaultErrorWebExceptionHandler (order = -1)
@Slf4j
public class GlobalWebExceptionHandler implements WebExceptionHandler {

    private final ObjectMapper objectMapper;

    public GlobalWebExceptionHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public Mono<Void> handle(ServerWebExchange exchange, Throwable ex) {
        HttpStatus status = resolveStatus(ex);
        ErrorResponse body = buildBody(ex);

        exchange.getResponse().setStatusCode(status);
        exchange.getResponse().getHeaders()
            .setContentType(MediaType.APPLICATION_JSON);

        try {
            byte[] bytes = objectMapper.writeValueAsBytes(body);
            DataBuffer buffer = exchange.getResponse().bufferFactory().wrap(bytes);
            return exchange.getResponse().writeWith(Mono.just(buffer));
        } catch (JsonProcessingException e) {
            return Mono.error(e);
        }
    }

    private HttpStatus resolveStatus(Throwable ex) {
        if (ex instanceof NotFoundException)            return HttpStatus.NOT_FOUND;
        if (ex instanceof ValidationException)         return HttpStatus.UNPROCESSABLE_ENTITY;
        if (ex instanceof ConflictException)           return HttpStatus.CONFLICT;
        if (ex instanceof ExternalServiceException)    return HttpStatus.BAD_GATEWAY;
        if (ex instanceof WebExchangeBindException)    return HttpStatus.UNPROCESSABLE_ENTITY;
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }

    private ErrorResponse buildBody(Throwable ex) {
        if (ex instanceof NotFoundException)
            return ErrorResponse.of("NOT_FOUND", ex.getMessage());
        if (ex instanceof ValidationException || ex instanceof WebExchangeBindException)
            return ErrorResponse.of("VALIDATION_ERROR", ex.getMessage());
        if (ex instanceof ConflictException)
            return ErrorResponse.of("CONFLICT", ex.getMessage());
        if (ex instanceof ExternalServiceException) {
            log.error("External service error", ex);
            return ErrorResponse.of("EXTERNAL_SERVICE_ERROR", "A downstream service failed");
        }
        log.error("Unhandled exception", ex);
        return ErrorResponse.of("INTERNAL_ERROR", "An unexpected error occurred");
    }
}
```

**Default**: use `@RestControllerAdvice` unless you're already on a fully functional routing stack.

---

## 6. HTTP Error Response Shape

```java
// adapter/in/web/ErrorResponse.java
public record ErrorResponse(
    String code,
    String message,
    Instant timestamp
) {
    public static ErrorResponse of(String code, String message) {
        return new ErrorResponse(code, message, Instant.now());
    }
}
```

JSON output:
```json
{
  "code": "NOT_FOUND",
  "message": "Order not found: abc-123",
  "timestamp": "2024-11-01T12:34:56.789Z"
}
```

---

## 7. Mapping External Errors to Domain Errors

Outbound adapters must translate infrastructure/external exceptions into domain exceptions **before
they leave the adapter**. The application layer must never see `WebClientResponseException`,
`DataAccessException`, etc.

```java
// adapter/out/client/PaymentHttpAdapter.java
public Mono<PaymentResult> charge(ChargeCommand command) {
    return webClient.post()
        .uri("/charges")
        .bodyValue(toRequest(command))
        .retrieve()
        .onStatus(HttpStatusCode::is4xxClientError, response ->
            response.bodyToMono(String.class)
                .map(body -> new ValidationException("Payment rejected: " + body)))
        .onStatus(HttpStatusCode::is5xxServerError, response ->
            Mono.error(new ExternalServiceException("Payment service error", null)))
        .bodyToMono(PaymentApiResponse.class)
        .map(this::toDomain)
        .onErrorMap(WebClientException.class,
            ex -> new ExternalServiceException("Payment service unreachable", ex));
}

// adapter/out/persistence/OrderPersistenceAdapter.java (DB errors)
public Mono<Order> save(Order order) {
    return springRepo.save(mapper.toEntity(order))
        .map(mapper::toDomain)
        .onErrorMap(DataIntegrityViolationException.class,
            ex -> new ConflictException("Order with this ID already exists"));
}
```

---

## 8. Error Propagation Rules

| Rule | Detail |
|---|---|
| Never swallow errors | Don't use `onErrorResume` to return empty/default when the error signals a real failure |
| Translate at the boundary | Outbound adapters translate infra exceptions → domain exceptions before returning |
| No Spring types in domain | `domain/exception/` contains zero Spring/R2DBC/WebClient imports |
| Log once | Log with full stack trace in the global handler or where context is richest; downstream callers use `doOnError` for context-adding without full stack |
| Don't expose internals | `INTERNAL_ERROR` responses never include stack traces or DB messages |
| Reactive propagation is automatic | Errors thrown inside `flatMap`/`map` are automatically converted to error signals — no need to manually catch and wrap in `Mono.error()` (though explicit is preferred for clarity) |
