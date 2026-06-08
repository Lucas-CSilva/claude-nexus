# Testing Patterns Reference

Testing conventions for Spring WebFlux hexagonal architecture projects.

---

## Table of Contents
1. [Test Strategy by Layer](#1-test-strategy-by-layer)
2. [Domain Model Tests](#2-domain-model-tests)
3. [Application Service Tests (Domain Isolation)](#3-application-service-tests)
4. [Inbound Adapter Tests — WebTestClient](#4-inbound-adapter-tests--webtestclient)
5. [Outbound Adapter Tests — @DataR2dbcTest](#5-outbound-adapter-tests--datar2dbctest)
6. [StepVerifier Patterns](#6-stepverifier-patterns)
7. [Test Fixtures](#7-test-fixtures)
8. [Test Naming Convention](#8-test-naming-convention)
9. [Coverage Targets](#9-coverage-targets)

---

## 1. Test Strategy by Layer

```
┌─────────────────────────────────────────────────────────────────┐
│ Layer                │ Test Type        │ Spring Context         │
├─────────────────────────────────────────────────────────────────┤
│ domain/model         │ Plain JUnit 5    │ None                   │
│ application/service  │ JUnit 5 + Mockito│ None                   │
│ adapter/in/web       │ @WebFluxTest     │ Slice (web layer only) │
│ adapter/out/persist. │ @DataR2dbcTest   │ Slice (DB layer only)  │
│ Full integration     │ @SpringBootTest  │ Full (use sparingly)   │
└─────────────────────────────────────────────────────────────────┘
```

**Rule**: test each layer in the narrowest possible context. Never boot the full Spring context
to test a domain service.

---

## 2. Domain Model Tests

No Spring, no Mockito — just domain logic.

```java
// domain/model/OrderTest.java
class OrderTest {

    @Test
    void newOrder_calculatesCorrectTotal() {
        var order = Order.newOrder(
            new CustomerId("cust-1"),
            List.of(
                new OrderItem("prod-A", 2, new BigDecimal("10.00")),
                new OrderItem("prod-B", 1, new BigDecimal("25.00"))
            )
        );

        assertThat(order.total()).isEqualByComparingTo("45.00");
        assertThat(order.status()).isEqualTo(OrderStatus.PENDING);
        assertThat(order.id()).isNotNull();
    }

    @Test
    void newOrder_copiesItemsDefensively() {
        var items = new ArrayList<OrderItem>();
        items.add(new OrderItem("prod-A", 1, BigDecimal.TEN));
        var order = Order.newOrder(new CustomerId("c"), items);

        items.add(new OrderItem("prod-B", 1, BigDecimal.ONE));  // mutate original list

        assertThat(order.items()).hasSize(1);  // domain copy is unaffected
    }

    @Test
    void orderId_rejectsBlankValue() {
        assertThatThrownBy(() -> new OrderId(""))
            .isInstanceOf(ValidationException.class);
    }
}
```

---

## 3. Application Service Tests

Test application services in complete isolation: no Spring context, mocked outbound ports.

```java
// application/service/OrderServiceTest.java
class OrderServiceTest {

    // Mock the outbound PORTS (interfaces) — never mock the adapters
    private final OrderRepository orderRepository = mock(OrderRepository.class);
    private final InventoryGateway inventoryGateway = mock(InventoryGateway.class);

    private final OrderService service = new OrderService(orderRepository, inventoryGateway);

    // --- createOrder ---

    @Test
    void createOrder_savesAndReturnsOrder_whenInventoryAvailable() {
        var command = OrderFixtures.aCreateOrderCommand();
        when(inventoryGateway.checkAvailability(anyString(), anyInt()))
            .thenReturn(Mono.just(true));
        when(orderRepository.save(any())).thenAnswer(inv -> Mono.just(inv.getArgument(0)));

        StepVerifier.create(service.createOrder(command))
            .assertNext(order -> {
                assertThat(order.customerId()).isEqualTo(command.customerId());
                assertThat(order.status()).isEqualTo(OrderStatus.PENDING);
                assertThat(order.items()).hasSize(command.items().size());
            })
            .verifyComplete();

        verify(orderRepository).save(any());
    }

    @Test
    void createOrder_propagatesInsufficientInventory_whenUnavailable() {
        var command = OrderFixtures.aCreateOrderCommand();
        when(inventoryGateway.checkAvailability(anyString(), anyInt()))
            .thenReturn(Mono.just(false));  // inventory says no

        StepVerifier.create(service.createOrder(command))
            .expectError(InsufficientInventoryException.class)
            .verify();

        verify(orderRepository, never()).save(any());
    }

    @Test
    void createOrder_propagatesExternalServiceException_onInventoryFailure() {
        var command = OrderFixtures.aCreateOrderCommand();
        when(inventoryGateway.checkAvailability(anyString(), anyInt()))
            .thenReturn(Mono.error(new ExternalServiceException("Inventory down", null)));

        StepVerifier.create(service.createOrder(command))
            .expectError(ExternalServiceException.class)
            .verify();
    }

    // --- getOrder ---

    @Test
    void getOrder_returnsOrder_whenFound() {
        var expected = OrderFixtures.anOrder();
        when(orderRepository.findById(expected.id())).thenReturn(Mono.just(expected));

        StepVerifier.create(service.getOrder(expected.id()))
            .expectNext(expected)
            .verifyComplete();
    }

    @Test
    void getOrder_propagatesNotFound_whenMissing() {
        when(orderRepository.findById(any())).thenReturn(Mono.empty());

        StepVerifier.create(service.getOrder(new OrderId("missing")))
            .expectError(OrderNotFoundException.class)
            .verify();
    }
}
```

---

## 4. Inbound Adapter Tests — WebTestClient

Use `@WebFluxTest` to load only the web layer. Mock inbound port interfaces (use-cases) with
`@MockBean`. Verify HTTP status, response body, and error mapping.

```java
// adapter/in/web/OrderControllerTest.java
@WebFluxTest(controllers = OrderController.class)
@Import(GlobalExceptionHandler.class)  // include global handler so error mapping is tested
class OrderControllerTest {

    @Autowired
    private WebTestClient client;

    @MockBean private CreateOrderUseCase createOrderUseCase;
    @MockBean private GetOrderUseCase getOrderUseCase;

    // --- POST /orders ---

    @Test
    void POST_createOrder_returns201_withBody_whenValid() {
        var order = OrderFixtures.anOrder();
        when(createOrderUseCase.createOrder(any())).thenReturn(Mono.just(order));

        client.post().uri("/orders")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(OrderFixtures.aCreateOrderRequestJson())
            .exchange()
            .expectStatus().isCreated()
            .expectBody(OrderResponse.class)
            .value(resp -> {
                assertThat(resp.id()).isEqualTo(order.id().value());
                assertThat(resp.status()).isEqualTo("PENDING");
            });
    }

    @Test
    void POST_createOrder_returns422_whenRequestBodyInvalid() {
        client.post().uri("/orders")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue("""
                { "customerId": "", "items": [] }
                """)
            .exchange()
            .expectStatus().isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY)
            .expectBody(ErrorResponse.class)
            .value(err -> assertThat(err.code()).isEqualTo("VALIDATION_ERROR"));
    }

    @Test
    void POST_createOrder_returns422_whenInventoryInsufficient() {
        when(createOrderUseCase.createOrder(any()))
            .thenReturn(Mono.error(new InsufficientInventoryException("prod-A")));

        client.post().uri("/orders")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(OrderFixtures.aCreateOrderRequestJson())
            .exchange()
            .expectStatus().isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
    }

    // --- GET /orders/{id} ---

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
        when(getOrderUseCase.getOrder(any()))
            .thenReturn(Mono.error(new OrderNotFoundException(new OrderId("x"))));

        client.get().uri("/orders/x")
            .exchange()
            .expectStatus().isNotFound()
            .expectBody(ErrorResponse.class)
            .value(err -> assertThat(err.code()).isEqualTo("NOT_FOUND"));
    }
}
```

---

## 5. Outbound Adapter Tests — @DataR2dbcTest

Use `@DataR2dbcTest` to test persistence adapters with a real (embedded/Testcontainers) database.
Only the persistence slice loads — no web layer.

```java
// adapter/out/persistence/OrderPersistenceAdapterTest.java
@DataR2dbcTest
@Import({OrderPersistenceAdapter.class, OrderPersistenceMapper.class})
@Testcontainers
class OrderPersistenceAdapterTest {

    @Container
    static PostgreSQLContainer<?> postgres =
        new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void registerProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.r2dbc.url", () ->
            "r2dbc:postgresql://%s:%d/%s".formatted(
                postgres.getHost(), postgres.getMappedPort(5432), postgres.getDatabaseName()));
        registry.add("spring.r2dbc.username", postgres::getUsername);
        registry.add("spring.r2dbc.password", postgres::getPassword);
    }

    @Autowired private OrderPersistenceAdapter adapter;
    @Autowired private SpringDataOrderRepository orderRepo;
    @Autowired private SpringDataOrderItemRepository itemRepo;

    @BeforeEach
    void cleanUp() {
        // Clean tables in dependency order
        StepVerifier.create(itemRepo.deleteAll().then(orderRepo.deleteAll()))
            .verifyComplete();
    }

    @Test
    void save_persistsOrder_andFindById_retrievesIt() {
        var order = OrderFixtures.anOrder();

        StepVerifier.create(adapter.save(order).then(adapter.findById(order.id())))
            .assertNext(found -> {
                assertThat(found.id()).isEqualTo(order.id());
                assertThat(found.customerId()).isEqualTo(order.customerId());
                assertThat(found.items()).hasSize(order.items().size());
                assertThat(found.status()).isEqualTo(OrderStatus.PENDING);
            })
            .verifyComplete();
    }

    @Test
    void findById_returnsEmpty_whenOrderDoesNotExist() {
        StepVerifier.create(adapter.findById(new OrderId("nonexistent")))
            .verifyComplete();  // empty Mono — not an error at adapter level
    }
}
```

---

## 6. StepVerifier Patterns

```java
// Assert a single emitted item
StepVerifier.create(mono)
    .assertNext(item -> {
        assertThat(item.id()).isNotNull();
        assertThat(item.status()).isEqualTo(PENDING);
    })
    .verifyComplete();

// Assert an expected error type
StepVerifier.create(mono)
    .expectError(OrderNotFoundException.class)
    .verify();

// Assert error type AND message
StepVerifier.create(mono)
    .expectErrorSatisfies(ex -> {
        assertThat(ex).isInstanceOf(OrderNotFoundException.class);
        assertThat(ex.getMessage()).contains("abc-123");
    })
    .verify();

// Assert a Flux emits multiple items in order
StepVerifier.create(flux)
    .expectNextMatches(o -> o.status() == PENDING)
    .expectNextMatches(o -> o.status() == CONFIRMED)
    .verifyComplete();

// Assert a Flux emits N items (when exact values don't matter)
StepVerifier.create(flux)
    .expectNextCount(3)
    .verifyComplete();

// Verify Mono<Void> completes without error
StepVerifier.create(mono)
    .verifyComplete();

// Test with virtual time (scheduled retries, delays)
StepVerifier.withVirtualTime(() ->
        service.processWithRetry(command)
            .retryWhen(Retry.fixedDelay(3, Duration.ofSeconds(1))))
    .expectSubscription()
    .thenAwait(Duration.ofSeconds(3))
    .verifyComplete();

// ❌ NEVER call .block() in a test to get the value — always use StepVerifier
// ❌ NEVER wrap Mono in a CountDownLatch — StepVerifier handles that
```

---

## 7. Test Fixtures

Keep test data factories in a `{Domain}Fixtures` class per aggregate. Fixtures build valid default
objects that can be customised with with-style builders or direct overrides.

```java
// test support (not in production source set — place in src/test/java)
// support/OrderFixtures.java
public final class OrderFixtures {

    private OrderFixtures() {}

    public static Order anOrder() {
        return new Order(
            new OrderId(UUID.randomUUID().toString()),
            new CustomerId("cust-default"),
            List.of(anOrderItem()),
            OrderStatus.PENDING,
            Instant.now()
        );
    }

    public static Order anOrderWith(OrderStatus status) {
        var base = anOrder();
        return new Order(base.id(), base.customerId(), base.items(), status, base.createdAt());
    }

    public static OrderItem anOrderItem() {
        return new OrderItem("prod-default", 1, new BigDecimal("9.99"));
    }

    public static CreateOrderCommand aCreateOrderCommand() {
        return new CreateOrderCommand(
            new CustomerId("cust-default"),
            List.of(anOrderItem())
        );
    }

    public static String aCreateOrderRequestJson() {
        return """
            {
              "customerId": "cust-default",
              "items": [{ "productId": "prod-default", "quantity": 1, "unitPrice": 9.99 }]
            }
            """;
    }
}
```

---

## 8. Test Naming Convention

```
{methodOrScenario}_{outcome}_{condition}
```

Examples:
- `getOrder_returnsOrder_whenFound`
- `createOrder_propagatesNotFound_whenRepositoryReturnsEmpty`
- `POST_order_returns422_whenCustomerIdBlank`
- `save_persistsOrder_andFindById_retrievesIt`

For web tests, prefix with the HTTP verb and resource in caps: `GET_order_...`, `POST_order_...`.

---

## 9. Coverage Targets

| Layer | Target | Rationale |
|---|---|---|
| `domain/model` | 90%+ | Pure logic, cheap to test, high value |
| `application/service` | 90%+ | Core business flows + error paths |
| `adapter/in/web` | 80%+ | Happy path + main error cases per endpoint |
| `adapter/out/persistence` | Key paths | Save + find; error mapping |
| `adapter/out/client` | Error mapping | Focus on error translation, not HTTP mechanics |
| Integration tests | Smoke only | One or two end-to-end flows to catch wiring errors |

**What not to test**: Spring wiring itself, `@Configuration` beans, Lombok-generated code,
and framework behaviour (validation annotations, Jackson serialisation) — test the outcomes,
not the framework.
