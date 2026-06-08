# Mermaid Diagram Gallery

Verified, copy-pasteable examples. Each diagram is annotated with the patterns it demonstrates.
Use these as starting templates — adapt IDs and labels to your domain.

## Table of Contents
1. [Flowcharts](#1-flowcharts)
   - 1a. Simple decision flow
   - 1b. Parallel branches + subgraphs
   - 1c. CI/CD pipeline (LR)
2. [Sequence Diagrams](#2-sequence-diagrams)
   - 2a. REST auth flow with alt block
   - 2b. Event-driven async messaging
3. [Class Diagrams](#3-class-diagrams)
   - 3a. Domain aggregate with enums
   - 3b. Repository pattern with interfaces
4. [Entity-Relationship Diagrams](#4-entity-relationship-diagrams)
   - 4a. E-commerce schema
5. [State Diagrams](#5-state-diagrams)
   - 5a. Order lifecycle
   - 5b. Connection state machine with concurrent states
6. [Architecture / Microservices](#6-architecture--microservices)
   - 6a. Three-tier web app
   - 6b. Event-driven microservices (multi-bounded-context)

---

## 1. Flowcharts

### 1a. Simple decision flow
*Demonstrates: decision diamond, multiple exit paths, terminal nodes, quoted label with parentheses*

```mermaid
flowchart TD
  Start([Request received]) --> Auth{"Authenticated?"}
  Auth -- No --> Return401[Return 401 Unauthorized]
  Auth -- Yes --> Perm{"Has permission?"}
  Perm -- No --> Return403[Return 403 Forbidden]
  Perm -- Yes --> RateLimit{"Rate limit OK?"}
  RateLimit -- No --> Return429[Return 429 Too Many Requests]
  RateLimit -- Yes --> Handle["Handle request\n(business logic)"]
  Handle --> Success[Return 200 OK]

  Return401 --> End([End])
  Return403 --> End
  Return429 --> End
  Success --> End
```

---

### 1b. Parallel branches + subgraphs
*Demonstrates: subgraphs as bounded contexts, parallel edges, database node shape, styled subgraph labels*

```mermaid
flowchart TD
  Input([User submits order]) --> Validate[Validate payload]
  Validate --> Fork{ }

  subgraph "Async Processing"
    Fork --> Inventory[Check inventory]
    Fork --> Pricing[Calculate pricing]
    Fork --> Fraud[Fraud screening]
  end

  Inventory & Pricing & Fraud --> Join{ }
  Join --> Persist[("Persist order\norders DB")]
  Persist --> Emit[Emit OrderPlaced event]
  Emit --> Respond[Return 202 Accepted]
```

---

### 1c. CI/CD pipeline (LR)
*Demonstrates: LR direction for sequential pipelines, edge labels with protocols, stadium nodes*

```mermaid
flowchart LR
  Commit([Git push]) --> Lint[Lint & format]
  Lint --> Test[Unit tests]
  Test --> Build[Build Docker image]
  Build --> Scan[Security scan]
  Scan --> Gate{"Quality\ngate?"}

  Gate -- Pass --> Push[Push to registry]
  Gate -- Fail --> Notify[Notify Slack]
  Notify --> End([Blocked])

  Push --> StageDeploy[Deploy to staging]
  StageDeploy --> E2E[E2E tests]
  E2E --> Approve{"Manual\napproval?"}
  Approve -- Approved --> ProdDeploy[Deploy to prod]
  Approve -- Rejected --> Rollback[Rollback staging]
  ProdDeploy --> Done([Live])
  Rollback --> End
```

---

## 2. Sequence Diagrams

### 2a. REST auth flow with alt block
*Demonstrates: autonumber, actor vs participant, alt/else/end, activate/deactivate, note*

```mermaid
sequenceDiagram
  autonumber
  actor User
  participant Client as "Browser / App"
  participant GW as "API Gateway"
  participant Auth as "Auth Service"
  participant DB as "User DB"

  User->>Client: Enter credentials
  Client->>GW: POST /auth/login
  GW->>Auth: Forward request

  activate Auth
  Auth->>DB: SELECT * FROM users WHERE email = ?
  DB-->>Auth: User row (hashed password)

  alt Credentials valid
    Auth-->>GW: 200 OK + JWT
    GW-->>Client: 200 OK + JWT
    Client-->>User: Redirect to dashboard
  else Invalid password
    Auth-->>GW: 401 Unauthorized
    GW-->>Client: 401 Unauthorized
    Client-->>User: Show error message
  else Account locked
    Auth-->>GW: 403 Forbidden
    GW-->>Client: 403 Forbidden
    Client-->>User: Show lockout screen
  end
  deactivate Auth

  Note over Client,GW: JWT stored in HttpOnly cookie
```

---

### 2b. Event-driven async messaging
*Demonstrates: par block for concurrent paths, -x for fire-and-forget, loop block, open arrow for async*

```mermaid
sequenceDiagram
  autonumber
  participant API as "Order API"
  participant Bus as "Message Bus\n(RabbitMQ)"
  participant Inv as "Inventory Service"
  participant Notif as "Notification Service"
  participant Ship as "Shipping Service"

  API-)Bus: OrderPlaced event
  Note right of Bus: Fan-out exchange

  par Process in parallel
    Bus-)Inv: Reserve inventory
  and
    Bus-)Notif: Send confirmation email
  and
    Bus-)Ship: Create shipment record
  end

  loop Retry (max 3)
    Inv->>Inv: Check warehouse stock
  end

  alt Stock available
    Inv-)Bus: InventoryReserved
    Bus-)API: Update order status → CONFIRMED
  else Out of stock
    Inv-)Bus: InventoryFailed
    Bus-)API: Update order status → FAILED
    Bus-)Notif: Send apology email
  end
```

---

## 3. Class Diagrams

### 3a. Domain aggregate with enums
*Demonstrates: visibility modifiers, generic types (List~T~), enum stereotype, relationships with labels*

```mermaid
classDiagram
  class Order {
    +UUID id
    +UUID customerId
    +OrderStatus status
    +Money total
    +List~LineItem~ lineItems
    +DateTime createdAt
    +DateTime updatedAt
    +place() void
    +cancel(reason: String) void
    +addItem(item: LineItem) void
    -recalculateTotal() Money
  }

  class LineItem {
    +UUID id
    +UUID productId
    +String productName
    +int quantity
    +Money unitPrice
    +Money subtotal()
  }

  class Money {
    +BigDecimal amount
    +String currency
    +add(other: Money) Money
    +multiply(factor: int) Money
  }

  class OrderStatus {
    <<enumeration>>
    DRAFT
    PENDING_PAYMENT
    PAID
    FULFILLING
    SHIPPED
    DELIVERED
    CANCELLED
    REFUNDED
  }

  class Customer {
    +UUID id
    +String email
    +String name
    +Address shippingAddress
  }

  Order "1" *-- "1..*" LineItem : contains
  LineItem --> Money : has price
  Order --> Money : has total
  Order --> OrderStatus : has
  Customer "1" --> "0..*" Order : places
```

---

### 3b. Repository pattern with interfaces
*Demonstrates: interface stereotype, realization (..|>), dependency (..>), namespace grouping*

```mermaid
classDiagram
  namespace Domain {
    class User {
      +UUID id
      +String email
      +String hashedPassword
    }
    class IUserRepository {
      <<interface>>
      +findById(id: UUID) User
      +findByEmail(email: String) User
      +save(user: User) void
      +delete(id: UUID) void
    }
  }

  namespace Infrastructure {
    class PostgresUserRepository {
      -DataSource dataSource
      +findById(id: UUID) User
      +findByEmail(email: String) User
      +save(user: User) void
      +delete(id: UUID) void
    }
    class CachedUserRepository {
      -IUserRepository delegate
      -Cache cache
      +findById(id: UUID) User
      +findByEmail(email: String) User
      +save(user: User) void
      +delete(id: UUID) void
    }
  }

  namespace Application {
    class UserService {
      -IUserRepository repo
      +getUser(id: UUID) User
      +register(email: String, password: String) User
    }
  }

  PostgresUserRepository ..|> IUserRepository : implements
  CachedUserRepository ..|> IUserRepository : implements
  CachedUserRepository ..> IUserRepository : delegates to
  UserService ..> IUserRepository : depends on
```

---

## 4. Entity-Relationship Diagrams

### 4a. E-commerce schema
*Demonstrates: PK/FK annotations, all cardinality variants, multi-table schema*

```mermaid
erDiagram
  CUSTOMER {
    uuid id PK
    string email "unique"
    string first_name
    string last_name
    timestamp created_at
  }

  ADDRESS {
    uuid id PK
    uuid customer_id FK
    string street_line_1
    string street_line_2
    string city
    string country_code
    string postal_code
    boolean is_default
  }

  ORDER {
    uuid id PK
    uuid customer_id FK
    uuid shipping_address_id FK
    string status
    decimal subtotal
    decimal tax
    decimal shipping_cost
    decimal total
    timestamp placed_at
    timestamp updated_at
  }

  ORDER_ITEM {
    uuid id PK
    uuid order_id FK
    uuid product_variant_id FK
    int quantity
    decimal unit_price_snapshot
  }

  PRODUCT {
    uuid id PK
    string slug "unique"
    string name
    string description
    boolean is_active
  }

  PRODUCT_VARIANT {
    uuid id PK
    uuid product_id FK
    string sku "unique"
    string size
    string color
    decimal price
    int stock_quantity
  }

  CUSTOMER ||--o{ ADDRESS : "has"
  CUSTOMER ||--o{ ORDER : "places"
  ADDRESS ||--o{ ORDER : "ships to"
  ORDER ||--|{ ORDER_ITEM : "contains"
  PRODUCT_VARIANT ||--o{ ORDER_ITEM : "referenced by"
  PRODUCT ||--|{ PRODUCT_VARIANT : "has"
```

---

## 5. State Diagrams

### 5a. Order lifecycle
*Demonstrates: labeled transitions, note, descriptive guard conditions*

```mermaid
stateDiagram-v2
  [*] --> Draft : createOrder()

  Draft --> AwaitingPayment : submit()
  Draft --> Cancelled : cancel()

  AwaitingPayment --> PaymentProcessing : initiatePayment()
  AwaitingPayment --> Cancelled : cancel() / timeout

  PaymentProcessing --> Paid : paymentSucceeded
  PaymentProcessing --> PaymentFailed : paymentFailed

  PaymentFailed --> AwaitingPayment : retryPayment()
  PaymentFailed --> Cancelled : cancel()

  Paid --> Fulfilling : startFulfillment()
  Fulfilling --> Shipped : markShipped()
  Shipped --> Delivered : confirmDelivery()
  Delivered --> Refunded : requestRefund() [within 30 days]

  Cancelled --> [*]
  Delivered --> [*]
  Refunded --> [*]

  note right of PaymentProcessing
    Async: webhook from payment gateway
    Timeout after 15 minutes → PaymentFailed
  end note
```

---

### 5b. Connection state machine with concurrent states
*Demonstrates: concurrent (parallel) states using -- separator*

```mermaid
stateDiagram-v2
  [*] --> Disconnected

  Disconnected --> Connecting : connect()
  Connecting --> Connected : handshakeComplete
  Connecting --> Disconnected : timeout / error

  state Connected {
    [*] --> Idle

    state "Data Exchange" as Exchange {
      [*] --> Ready
      --
      [*] --> Unauthenticated
      Unauthenticated --> Authenticated : authenticate()
    }

    Idle --> Exchange : startSession()
    Exchange --> Idle : endSession()
  }

  Connected --> Disconnecting : disconnect()
  Connected --> Disconnected : networkError
  Disconnecting --> Disconnected : gracefulClose
```

---

## 6. Architecture / Microservices

### 6a. Three-tier web app
*Demonstrates: TD layered layout, subgraph per tier, edge labels with protocols*

```mermaid
flowchart TD
  subgraph Clients["Client Layer"]
    Browser["Browser\n(React SPA)"]
    Mobile["Mobile App\n(React Native)"]
  end

  subgraph Edge["Edge / Gateway"]
    CDN["CDN\n(CloudFront)"]
    WAF["WAF"]
    LB["Load Balancer\n(ALB)"]
  end

  subgraph App["Application Layer (ECS)"]
    API1["API Server\nreplica 1"]
    API2["API Server\nreplica 2"]
    API3["API Server\nreplica 3"]
  end

  subgraph Data["Data Layer"]
    Primary[("Postgres Primary\nRDS")]
    Replica[("Postgres Replica\nRDS read-only")]
    Cache[["Redis\nElastiCache"]]
    S3[["S3\nObject Storage"]]
  end

  Browser & Mobile -->|HTTPS| CDN
  CDN -->|HTTPS| WAF
  WAF -->|HTTPS| LB
  LB -->|HTTP| API1 & API2 & API3

  API1 & API2 & API3 -->|SQL writes| Primary
  API1 & API2 & API3 -->|SQL reads| Replica
  API1 & API2 & API3 -->|GET/SET| Cache
  API1 & API2 & API3 -->|PUT/GET| S3

  Primary -->|replication| Replica
```

---

### 6b. Event-driven microservices (multi-bounded-context)
*Demonstrates: LR layout for event flow, multiple bounded contexts as subgraphs, message bus as central node, async vs sync edge labels*

```mermaid
flowchart LR
  subgraph External["External"]
    Client["API Client"]
  end

  subgraph OrderBC["Order Context"]
    OrderAPI["Order API\n:8080"]
    OrderSvc["Order Service"]
    OrderDB[("Orders DB")]
  end

  subgraph PaymentBC["Payment Context"]
    PaySvc["Payment Service"]
    PayDB[("Payments DB")]
    PayGW["Payment Gateway\n(Stripe)"]
  end

  subgraph InventoryBC["Inventory Context"]
    InvSvc["Inventory Service"]
    InvDB[("Inventory DB")]
  end

  subgraph NotifBC["Notification Context"]
    NotifSvc["Notification Service"]
    EmailProvider["Email\n(SendGrid)"]
    SMSProvider["SMS\n(Twilio)"]
  end

  subgraph Infra["Infrastructure"]
    Bus[["Event Bus\n(Kafka)"]]
  end

  Client -->|REST| OrderAPI
  OrderAPI --> OrderSvc
  OrderSvc --> OrderDB

  OrderSvc -->|OrderPlaced| Bus
  Bus -->|OrderPlaced| PaySvc
  Bus -->|OrderPlaced| InvSvc
  Bus -->|OrderPlaced| NotifSvc

  PaySvc --> PayDB
  PaySvc -->|HTTPS| PayGW
  PayGW -->|webhook| PaySvc
  PaySvc -->|PaymentConfirmed\nPaymentFailed| Bus

  Bus -->|PaymentConfirmed| InvSvc
  Bus -->|PaymentConfirmed\nPaymentFailed| NotifSvc

  InvSvc --> InvDB
  InvSvc -->|InventoryReserved\nInventoryFailed| Bus

  NotifSvc -->|SMTP| EmailProvider
  NotifSvc -->|API| SMSProvider
```

---

## Quick-Reference: Syntax Reminders

```
%% This is a comment — works in all diagram types

%% Flowchart — shapes
A[Rectangle]
B(Rounded)
C([Stadium])
D{Diamond}
E[(Database)]
F[[Queue / Subroutine]]
G((Circle))

%% Flowchart — edges
A --> B          %% arrow
A --- B          %% line, no arrow
A -->|label| B   %% labeled arrow
A -.-> B         %% dotted arrow
A ==> B          %% thick arrow
A --o B          %% circle end
A --x B          %% cross end

%% Sequence — arrow types
A->>B: sync call
A-->>B: response / async reply
A-)B: async fire-and-forget
A-xB: failed / terminated

%% Class — relationship types
A <|-- B    %% B extends A
A *-- B     %% composition
A o-- B     %% aggregation
A --> B     %% association
A ..> B     %% dependency
A ..|> B    %% B implements A
A .. B      %% link (dashed)
```
