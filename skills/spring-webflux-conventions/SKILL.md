---
name: spring-webflux-conventions
description: >
  Defines coding conventions, patterns, and project structure for backend development in Java with
  Spring WebFlux (reactive stack) using hexagonal architecture (ports & infrastructure). Use this skill
  whenever writing, reviewing, or scaffolding any Spring WebFlux backend code — including creating
  new features, new projects, controllers, services, repositories, error handlers, tests, or
  configuration. Trigger on phrases like "create a Spring WebFlux endpoint", "reactive Spring service",
  "R2DBC repository", "hexagonal architecture", "WebFlux handler", "reactive backend", "Spring reactive",
  "ports and infrastructure", "WebTestClient test", "StepVerifier", or any request to produce Java code for
  a reactive Spring backend. Also trigger when asked to explain how a request flows through the
  application or how layers should communicate in this stack.
---

# Spring WebFlux — Hexagonal Architecture Conventions

> **Scope**: This skill owns *how* code is written and structured. General reactive/Java knowledge
> lives in the agent. When you need architecture or flow diagrams, use the **mermaid** skill.
> When implementing a feature, reference requirement IDs from the spec produced by **project-docs**.

---

## 1. Package Layout

```
com.example.{app}/
├── domain/
│   ├── model/              # Entities, value objects — pure Java, no framework deps
│   ├── exception/          # Domain exceptions (framework-free)
│   ├── port/               # Port interfaces — any interface the service uses or implements
│   ├── service/            # Domain services — coordinate business logic via ports
│   ├── command/            # Command DTOs — request objects for domain operations
│   └── commandhandler/    # Command handlers — execute commands, produce domain events
├── application/
│   └── rest/               # @RestController or RouterFunction + request/response DTOs
└── infrastructure/
    ├── config/             # Spring config, security, filters, beans
    ├── persistence/        # R2DBC entities, Spring Data repos, mappers
    └── client/             # WebClient-based external service implementations
```

**Dependency rule**: `domain` (framework-free) ← `application` ← `infrastructure` (Spring). 
Domain is pure business logic, ports, services, and commands — zero framework imports.
Application exposes the domain via REST controllers.
Infrastructure implements domain ports and handles Spring concerns (config, persistence, clients).

**Port organization**: Ports live in `domain/port/` without in/out subdirectories. The
domain service decides what it implements (like a use-case interface) and what it depends on
(like a repository), but the directory structure treats them uniformly.

**Reactive types in signatures**: `Mono<T>` / `Flux<T>` are permitted in domain model, port
interfaces, and application service signatures. In an all-reactive system, confining reactive types
to infrastructure costs more than it's worth.

**Endpoint style default**: `@RestController` (annotated style). Functional `RouterFunction` is the
alternative for complex routing or handler composition — both live exclusively in `application.rest`.

---

## 2. Canonical Layer Wiring

```java
// --- domain/model/Order.java ---
public record Order(OrderId id, CustomerId customerId, OrderStatus status) {}

// --- domain/exception/OrderNotFoundException.java ---
public class OrderNotFoundException extends RuntimeException {
    public OrderNotFoundException(OrderId id) {
        super("Order not found: " + id.value());
    }
}

// --- domain/port/GetOrderUseCase.java ---
public interface GetOrderUseCase {
    Mono<Order> getOrder(OrderId id);
}

// --- domain/port/OrderRepository.java ---
public interface OrderRepository {
    Mono<Order> findById(OrderId id);
    Mono<Order> save(Order order);
}

// --- domain/service/OrderService.java ---
@Service
@RequiredArgsConstructor
public class OrderService implements GetOrderUseCase {

    private final OrderRepository orderRepository;   // Port dependency — NOT the Spring Data type

    @Override
    public Mono<Order> getOrder(OrderId id) {
        return orderRepository.findById(id)
            .switchIfEmpty(Mono.error(new OrderNotFoundException(id)));
    }
}

// --- application/rest/OrderController.java ---
@RestController
@RequestMapping("/orders")
@RequiredArgsConstructor
public class OrderController {

    private final GetOrderUseCase getOrderUseCase;   // Domain port injected by Spring

    @GetMapping("/{id}")
    public Mono<ResponseEntity<OrderResponse>> getOrder(@PathVariable String id) {
        return getOrderUseCase.getOrder(new OrderId(id))
            .map(OrderResponse::from)
            .map(ResponseEntity::ok);
    }
}
```

Full end-to-end slice with persistence infrastructure, wiring, and DTOs → **`references/feature-slice.md`**.

---

## 3. Reactive Idioms

### ✅ DO

```java
// Wrap unavoidable blocking I/O — use boundedElastic, name the thread pool
Mono.fromCallable(this::callLegacyBlockingApi)
    .subscribeOn(Schedulers.boundedElastic());

// Chain operators declaratively
return userRepository.findById(userId)
    .flatMap(user -> orderRepository.findByUser(user.id()))
    .map(OrderResponse::from);

// Propagate context (e.g., trace IDs, security)
return Mono.deferContextual(ctx ->
    Mono.just(ctx.getOrDefault("traceId", "unknown"))
        .flatMap(traceId -> processWithTrace(traceId, command)));

// Use switchIfEmpty for "not found" semantic
return repo.findById(id)
    .switchIfEmpty(Mono.error(new NotFoundException(id)));

// defaultIfEmpty for optional results
return repo.findPreference(userId)
    .defaultIfEmpty(Preference.defaults());
```

### ❌ DON'T

```java
// NEVER block inside a reactive chain — this parks the event-loop thread
Order order = orderRepository.findById(id).block();  // ← deadlock risk

// NEVER use subscribe() inside a reactive chain
repo.save(entity).subscribe();  // ← fire-and-forget loses errors; use then() / flatMap()

// NEVER nest subscribe() for chaining — use flatMap
userMono.subscribe(user ->
    orderMono.subscribe(order -> combine(user, order)));  // ← use zipWith or flatMap

// NEVER return Mono<Void> from a void method that silently swallows errors
public Mono<Void> process(Command cmd) {
    repo.save(toEntity(cmd)).subscribe();  // ← errors vanish
    return Mono.empty();                   // use: return repo.save(toEntity(cmd)).then();
}

// NEVER mix imperative exception throws inside operators without wrapping
.map(order -> {
    if (order == null) throw new RuntimeException("null");  // ← correct form below
    return order;
})
// Correct:
.flatMap(order -> order == null
    ? Mono.error(new OrderNotFoundException(...))
    : Mono.just(order))
```

---

## 4. Error Handling

**Rule**: Domain throws framework-free exceptions (`domain/exception/`). The REST layer
(or a global `@ControllerAdvice`) translates them to HTTP responses.

```java
// --- domain/exception/DomainException.java (base) ---
public abstract class DomainException extends RuntimeException {
    protected DomainException(String message) { super(message); }
}

// --- application/rest/GlobalExceptionHandler.java ---
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(OrderNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(OrderNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(new ErrorResponse("NOT_FOUND", ex.getMessage()));
    }

    @ExceptionHandler(ValidationException.class)
    public ResponseEntity<ErrorResponse> handleValidation(ValidationException ex) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
            .body(new ErrorResponse("VALIDATION_ERROR", ex.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneric(Exception ex) {
        log.error("Unhandled error", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(new ErrorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
}

// --- Operator-level error handling in service layer ---
return externalClient.fetch(id)
    .onErrorMap(WebClientResponseException.NotFound.class, e -> new OrderNotFoundException(id))
    .onErrorMap(WebClientException.class, e -> new ExternalServiceException("Client error", e));
```

Full error model with functional equivalent and reactive error propagation → **`references/error-model.md`**.

---

## 5. Data Access — R2DBC (Default)

R2DBC is the default reactive persistence choice. Reactive Mongo is the alternative for
document-oriented data; the port/infrastructure boundary is identical.

```java
// --- infrastructure/persistence/OrderPersistenceAdapter.java ---
// Implements the OrderRepository port — Spring Data types never leak past this class.
@Component
@RequiredArgsConstructor
public class OrderPersistenceAdapter implements OrderRepository {   // ← Port implementation

    private final SpringDataOrderRepository springRepo;             // ← Spring Data interface
    private final OrderPersistenceMapper mapper;

    @Override
    public Mono<Order> findById(OrderId id) {
        return springRepo.findById(id.value())
            .map(mapper::toDomain);
    }

    @Override
    public Mono<Order> save(Order order) {
        return springRepo.save(mapper.toEntity(order))
            .map(mapper::toDomain);
    }
}

// --- infrastructure/persistence/SpringDataOrderRepository.java ---
// Spring Data R2DBC — stays inside infrastructure, never referenced by domain/application
public interface SpringDataOrderRepository
        extends ReactiveCrudRepository<OrderEntity, String> {
    Flux<OrderEntity> findByCustomerId(String customerId);
}

// --- infrastructure/persistence/OrderEntity.java ---
@Table("orders")
public record OrderEntity(
    @Id String id,
    String customerId,
    String status
) {}

// --- infrastructure/persistence/OrderPersistenceMapper.java ---
@Component
public class OrderPersistenceMapper {
    public Order toDomain(OrderEntity e) {
        return new Order(new OrderId(e.id()), new CustomerId(e.customerId()),
            OrderStatus.valueOf(e.status()));
    }
    public OrderEntity toEntity(Order o) {
        return new OrderEntity(o.id().value(), o.customerId().value(), o.status().name());
    }
}
```

---

## 6. DTOs, Validation, and Mapping

- **DTOs live exclusively in `application/rest/`** — they never enter the domain layer.
- **Validation** is applied at the REST boundary using `@Valid` + `WebExchangeBindException`.
- **Mapping** between DTO ↔ domain object is done in the REST layer (a dedicated mapper class or a
  static factory method on the DTO).

```java
// --- application/rest/CreateOrderRequest.java ---
public record CreateOrderRequest(
    @NotBlank String customerId,
    @NotEmpty List<@Valid OrderItemRequest> items
) {
    public CreateOrderCommand toCommand() {                  // ← REST layer maps to domain command
        return new CreateOrderCommand(
            new CustomerId(customerId),
            items.stream().map(OrderItemRequest::toItem).toList()
        );
    }
}

// --- application/rest/OrderController.java (POST endpoint) ---
@PostMapping
@ResponseStatus(HttpStatus.CREATED)
public Mono<OrderResponse> createOrder(@RequestBody @Valid Mono<CreateOrderRequest> body) {
    return body
        .map(CreateOrderRequest::toCommand)
        .flatMap(createOrderUseCase::createOrder)
        .map(OrderResponse::from);
}
```

Validation errors surface as `WebExchangeBindException` → caught by `GlobalExceptionHandler`.

---

## 7. Cross-cutting Concerns

### Logging (reactive-safe — MDC via Reactor Context)

```java
// Populate MDC per-request in a WebFilter — infrastructure/config layer
@Component
public class MdcContextWebFilter implements WebFilter {
    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        String traceId = exchange.getRequest().getHeaders()
            .getFirst("X-Trace-Id");
        return chain.filter(exchange)
            .contextWrite(Context.of("traceId", traceId != null ? traceId : UUID.randomUUID().toString()));
    }
}

// In service — read from context, never use MDC directly in reactive chain
return Mono.deferContextual(ctx -> {
    String traceId = ctx.getOrDefault("traceId", "-");
    log.debug("[{}] Processing order {}", traceId, orderId);
    return doProcess(orderId);
});
```

### Security (Spring Security Reactive)

```java
// infrastructure/config/SecurityConfig.java — all security wiring stays in infrastructure/config
@Configuration
@EnableWebFluxSecurity
public class SecurityConfig {

    @Bean
    public SecurityWebFilterChain securityFilterChain(ServerHttpSecurity http) {
        return http
            .csrf(ServerHttpSecurity.CsrfSpec::disable)
            .authorizeExchange(exchanges -> exchanges
                .pathMatchers("/actuator/health").permitAll()
                .anyExchange().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
            .build();
    }
}
```

### Configuration

```java
// infrastructure/config/AppProperties.java
@ConfigurationProperties(prefix = "app")
@Validated
public record AppProperties(
    @NotBlank String externalServiceUrl,
    @NotNull Duration timeout
) {}
```

---

## 8. Testing Conventions

| Layer | Tool | Spring Context |
|---|---|---|
| Domain model | Plain JUnit 5 | None |
| Domain service | JUnit 5 + Mockito | None |
| REST layer | `WebTestClient` | `@WebFluxTest` (slice) |
| Persistence infrastructure | `@DataR2dbcTest` | Slice |
| Integration / full app | `WebTestClient` | `@SpringBootTest` |

```java
// Domain service — no Spring context, pure unit test
class OrderServiceTest {

    private final OrderRepository repo = mock(OrderRepository.class);
    private final OrderService service = new OrderService(repo);

    @Test
    void getOrder_returnsOrder_whenFound() {
        var expected = OrderFixtures.anOrder();
        when(repo.findById(expected.id())).thenReturn(Mono.just(expected));

        StepVerifier.create(service.getOrder(expected.id()))
            .expectNext(expected)
            .verifyComplete();
    }

    @Test
    void getOrder_propagatesNotFound_whenMissing() {
        when(repo.findById(any())).thenReturn(Mono.empty());

        StepVerifier.create(service.getOrder(new OrderId("missing")))
            .expectError(OrderNotFoundException.class)
            .verify();
    }
}

// REST layer — WebTestClient with @WebFluxTest
@WebFluxTest(OrderController.class)
class OrderControllerTest {

    @Autowired WebTestClient client;
    @MockBean GetOrderUseCase getOrderUseCase;

    @Test
    void GET_order_returns200_whenFound() {
        var order = OrderFixtures.anOrder();
        when(getOrderUseCase.getOrder(order.id())).thenReturn(Mono.just(order));

        client.get().uri("/orders/{id}", order.id().value())
            .exchange()
            .expectStatus().isOk()
            .expectBody(OrderResponse.class)
            .value(resp -> assertThat(resp.id()).isEqualTo(order.id().value()));
    }

    @Test
    void GET_order_returns404_whenNotFound() {
        when(getOrderUseCase.getOrder(any())).thenReturn(
            Mono.error(new OrderNotFoundException(new OrderId("x"))));

        client.get().uri("/orders/x")
            .exchange()
            .expectStatus().isNotFound();
    }
}
```

Full domain isolation test + persistence infrastructure test with embedded DB → **`references/testing-patterns.md`**.

**Coverage targets**: Domain + application layer: 90%+. Adapter layer: representative happy path
+ main error paths. Do not unit-test framework wiring.

---

## 9. Naming Conventions

| Artifact | Convention | Example |
|---|---|---|
| Domain port | `{Verb}{Noun}UseCase` or `{Noun}Repository` / `{Noun}Gateway` | `CreateOrderUseCase`, `OrderRepository` |
| Domain service | `{Noun}Service` | `OrderService` |
| Domain command | `{Verb}{Noun}Command` | `CreateOrderCommand` |
| Command handler | `{Verb}{Noun}CommandHandler` | `CreateOrderCommandHandler` |
| REST controller | `{Noun}Controller` / `{Noun}Router` | `OrderController` |
| Persistence infrastructure | `{Noun}PersistenceAdapter` | `OrderPersistenceAdapter` |
| HTTP/external infrastructure | `{Noun}HttpAdapter` / `{Noun}Adapter` | `PaymentHttpAdapter` |
| Spring Data repo (internal) | `SpringData{Noun}Repository` | `SpringDataOrderRepository` |
| Persistence entity | `{Noun}Entity` | `OrderEntity` |
| Request DTO | `{Verb}{Noun}Request` | `CreateOrderRequest` |
| Response DTO | `{Noun}Response` | `OrderResponse` |
| Test fixture factory | `{Noun}Fixtures` | `OrderFixtures` |

**Reactive return types**: methods returning a single item use `Mono<T>`; collections use `Flux<T>`.
Avoid `Mono<List<T>>` — use `Flux<T>` instead.

---

## 10. Cross-Skill References

**Diagrams** — when producing architecture diagrams (hexagonal layout, request lifecycle,
REST → port → domain sequence): invoke the **mermaid** skill. Sequence diagrams are
the natural fit for reactive request/response flows; component/flowchart diagrams suit the
hexagonal layout.

**Requirements traceability** — code produced under this skill should reference requirement IDs
from specs generated under the **project-docs** skill (e.g., `// REQ-ORDER-001`). This carries
traceability from spec to implementation.

---

## 11. Reference Files

Read these when producing the corresponding artifact:

| File | When to read |
|---|---|
| `references/feature-slice.md` | Scaffolding a new end-to-end feature; wiring REST → service → port → domain → infrastructure |
| `references/error-model.md` | Implementing global error handling, `onErrorMap`/`onErrorResume` chains, functional error handlers |
| `references/testing-patterns.md` | Writing domain-isolation tests, REST controller tests, `@DataR2dbcTest` infrastructure tests, `StepVerifier` patterns |
