---
title: "Databases by Access Pattern"
description: "Choose RDS, Aurora, DynamoDB, caches, and purpose-built data stores from the way an application reads and writes—not from a favorite engine."
order: 5
domain: performance
publishedAt: 2026-09-02
difficulty: Associate
tags:
  - RDS
  - Aurora
  - DynamoDB
  - ElastiCache
  - Databases
objectives:
  - Translate scenario wording into data model, query, scale, latency, consistency, and availability requirements
  - Separate relational high availability from read scaling and disaster recovery
  - Design DynamoDB keys and indexes around known access patterns
  - Recognize when a cache or purpose-built database is the smallest correct answer
featured: true
draft: false
---

AWS gives you many database services because **no database is best at every access pattern**. The exam rarely asks which logo you remember. It gives you a workload: orders must be transactional, sessions must survive bursts, recommendations traverse relationships, or dashboards aggregate years of events. Your job is to turn those verbs into a data-store decision.

> **Exam lens:** start with the way the application reads and writes. Do not start with “SQL versus NoSQL,” and do not choose a service merely because it can technically store the data.

## Start with six questions

Before comparing services, reduce the scenario to six requirements.

1. **Data model:** relational rows, key-value items, documents, a graph, time-stamped measurements, or analytical columns?
2. **Access pattern:** point lookup, range query, join, full-text search, relationship traversal, or aggregation across a large history?
3. **Scale shape:** steady and predictable, rapidly growing, bursty, or globally distributed?
4. **Latency target:** seconds, milliseconds, consistent single-digit milliseconds, or in-memory microseconds?
5. **Correctness:** are transactions, constraints, and strongly consistent reads mandatory, or can some reads be stale?
6. **Failure scope:** must it survive an instance failure, an Availability Zone failure, or an entire Region failure?

The answer is often visible before a product name appears:

```text
Need joins, foreign keys, or familiar SQL transactions?
├── Yes → RDS or Aurora
└── No
    ├── Known key-based requests at very large scale? → DynamoDB
    ├── Flexible JSON documents?                    → DocumentDB
    ├── Deep relationship traversal?                → Neptune
    ├── Timestamp-centered measurements?            → Timestream
    ├── Full-text relevance or log search?           → OpenSearch Service
    └── Large historical aggregations / BI?          → Redshift

Already have a durable system of record, but reads are too slow?
└── Put an appropriate cache in front of it; do not replace durability by accident.
```

This is the **purpose-built database** idea: a single application may legitimately use Aurora for orders, DynamoDB for carts, ElastiCache for hot sessions, and OpenSearch for product search. SAA questions reward the simplest service—or small combination of services—that directly matches the stated requirements.

## The service map

Use this table as a first pass, then validate the operational details later in the lecture.

| Workload signal | Likely service | Why it fits | Common wrong turn |
| --- | --- | --- | --- |
| SQL, joins, constraints, multi-row transactions | Amazon RDS or Amazon Aurora | Relational model and ACID transactions | DynamoDB because “NoSQL scales” |
| MySQL/PostgreSQL compatibility plus cloud-native relational scale and availability | Amazon Aurora | Distributed cluster storage, reader instances, managed failover | Self-managing a database on EC2 |
| Key-value or document items with known requests and massive horizontal scale | Amazon DynamoDB | Managed partitioning and low-latency key access | Running `Scan` for normal requests |
| Frequently reused, disposable data | Amazon ElastiCache | In-memory cache with very low latency | Treating a cache as the only durable copy |
| Durable Redis-compatible primary database | Amazon MemoryDB | In-memory access with durable, Multi-AZ storage | Selecting ElastiCache when durable writes are required |
| Flexible document model with MongoDB-compatible APIs | Amazon DocumentDB | Managed document database | Assuming every MongoDB feature behaves identically |
| Friends-of-friends, fraud rings, route dependencies | Amazon Neptune | Graph relationships and traversals | Modeling deep traversals as relational joins at scale |
| Device readings, operational measurements, time windows | Amazon Timestream | Time-series ingestion, retention, and time functions | A general-purpose relational table for an extreme event stream |
| Search relevance, autocomplete, log exploration | Amazon OpenSearch Service | Inverted indexes and search/analytics APIs | Making the search index the sole source of truth |
| Petabyte-scale BI and analytical SQL | Amazon Redshift | Columnar data warehouse for OLAP | Sending high-rate row transactions to a warehouse |
| Objects or a data lake queried occasionally | Amazon S3 with Athena | Serverless SQL over data in S3 | Provisioning an OLTP database for files and logs |

> “Managed” does not mean “every architecture property is automatic.” You still choose capacity, indexes, keys, replicas, backups, consistency, and recovery behavior.

## Relational choices: RDS and Aurora

Choose a relational database when the relationships and transactions are part of the requirement, not merely because the input happens to be tabular.

### Amazon RDS

Amazon RDS manages common relational engines, including PostgreSQL, MySQL, MariaDB, Oracle Database, SQL Server, and Db2. AWS handles tasks such as provisioning, patching, backups, monitoring integration, and replacement of failed infrastructure. You still own schema design, indexes, queries, connection behavior, and application-level recovery.

RDS is a strong answer when the scenario says:

- migrate an existing commercial or open-source database with minimal code change;
- preserve engine-specific behavior or licensing;
- enforce relational constraints and transactional correctness; or
- run complex, less predictable queries that benefit from SQL and joins.

Running the same engine on EC2 gives maximum operating-system and database control, but it also gives your team responsibility for installation, patching, backups, failover, and scaling. On the SAA exam, prefer RDS unless a requirement explicitly needs host-level control or an unsupported configuration.

### Amazon Aurora

Aurora is a managed relational engine compatible with MySQL or PostgreSQL. Compute instances are separated from a distributed storage volume replicated across multiple Availability Zones. That architecture enables fast managed failover, shared storage for Aurora Replicas, and storage growth without managing individual database volumes.

Aurora is especially attractive when a scenario requires:

- MySQL or PostgreSQL compatibility with higher cloud-native availability;
- several read replicas with lower replica lag than traditional engine replication;
- a reader endpoint that distributes **connections** among replicas;
- a global relational read or disaster-recovery architecture with Aurora Global Database; or
- capacity that changes substantially, using Aurora Serverless v2 where its supported behavior fits.

Know the endpoints:

```text
application writes ───────→ cluster/writer endpoint ──→ current writer

application read pool ────→ reader endpoint ──────────┬→ Aurora Replica A
                                                      ├→ Aurora Replica B
                                                      └→ Aurora Replica C
```

The reader endpoint balances new connections; it does not inspect and distribute every SQL statement. The application should use the writer endpoint for writes and the reader endpoint for read-only connections. During failover, DNS points an endpoint at the new role, so clients must reconnect and should not pin an instance address indefinitely.

### The most-tested distinction: availability is not read scale

“Multi-AZ” and “read replica” solve different problems.

| Feature | Primary goal | Replication and traffic | Failover role |
| --- | --- | --- | --- |
| RDS Multi-AZ **DB instance** deployment | High availability | Synchronous standby in another AZ; standby does not serve reads | RDS performs automatic failover |
| RDS Multi-AZ **DB cluster** deployment | High availability plus read capacity | One writer and two readable instances in three AZs, using semisynchronous replication | RDS performs automatic failover |
| RDS read replica | Read scaling; sometimes DR | Typically asynchronous; application sends reads to replica endpoint | Promotion is a deliberate operation, not the same HA mechanism |
| Aurora Replica | Read scaling and failover target | Reads shared cluster storage; application uses reader or instance endpoint | Aurora can promote a replica during failover |
| Aurora Global Database | Cross-Region reads and regional recovery | Primary Region replicates to secondary Region clusters | Planned or unplanned regional failover workflows |

The exam often uses “Multi-AZ” as shorthand for the classic RDS Multi-AZ DB instance deployment. Its standby is **not** a reporting replica. If the question asks to improve read throughput, add read replicas, use an RDS Multi-AZ DB cluster where supported and appropriate, or use Aurora readers. If it asks to minimize interruption after an AZ failure, choose the HA deployment.

> **Memory hook:** Multi-AZ keeps the database available. Read replicas keep reads away from the writer.

### Connections can be the bottleneck

A Lambda function can scale to many concurrent invocations faster than a relational database can accept new connections. Increasing instance size does not fix connection storms elegantly. Amazon RDS Proxy pools and reuses database connections, smoothing spikes and helping applications recover connections during failover. It does not replace a database, cache arbitrary query results, or make inefficient SQL efficient.

### Backups are not replicas

RDS automated backups support point-in-time recovery within the configured retention period. Manual snapshots persist until deleted. Replicas improve availability or serve traffic, but they reproduce changes—including an accidental destructive statement. A replica is therefore not a substitute for a recovery point.

For a relational scenario, keep three separate questions in mind:

- **HA:** which healthy instance can take over now?
- **Scale:** where can additional reads or writes go?
- **Recovery:** from which clean historical state can data be restored?

## DynamoDB: model the requests first

DynamoDB is a serverless key-value and document database designed for consistent performance at scale. You do not choose an instance type or manage shards directly. You do, however, need a data model that distributes traffic and answers the application's known requests efficiently.

That trade is central:

| Relational approach | DynamoDB approach |
| --- | --- |
| Normalize entities, then query flexibly | List access patterns, then design keys |
| Join related rows at request time | Often place related items together or denormalize |
| Scale a database instance and add replicas | Spread traffic across partition-key values |
| Add indexes for flexible predicates | Create a table key or secondary index for a defined request |

### Partition key and sort key

Every DynamoDB item is identified by a primary key:

- A **simple primary key** contains only a partition key.
- A **composite primary key** contains a partition key plus a sort key.

Items with the same partition-key value are stored together in sort-key order. That makes one-to-many requests efficient.

```text
PK             SK                       item
-------------- ------------------------ -------------------------
CUSTOMER#42    PROFILE                  name, email
CUSTOMER#42    ORDER#2026-08-17#901     total, status
CUSTOMER#42    ORDER#2026-08-29#955     total, status
CUSTOMER#87    PROFILE                  name, email
```

One `Query` can retrieve customer 42's orders within a date range because it specifies `PK = CUSTOMER#42` and applies a condition to the ordered sort key. A `Scan` examines items across the table or index, consumes capacity for what it reads rather than only what it returns, and is rarely the right foreground request for a large table.

> A `FilterExpression` does not rescue a poor key design. DynamoDB reads the candidate items first and filters afterward, so filtered-out items still contribute to consumed read capacity.

Choose a high-cardinality partition key that spreads requests. A low-cardinality or extremely popular value—such as putting every order under `PK = ORDERS`—can create a hot partition even when the table has plenty of total capacity.

### Secondary indexes are alternate doors

The base key supports one family of access patterns. Secondary indexes support additional ones.

| Index | Partition key | Creation | Consistency | Typical use |
| --- | --- | --- | --- | --- |
| Global secondary index (GSI) | Can differ from the table | Can be added after table creation | Eventually consistent reads | Query by an alternate entity or attribute |
| Local secondary index (LSI) | Same as the table | Must be defined when the table is created | Eventual or optional strong reads | Alternate ordering within one partition-key value |

Suppose the table key retrieves orders by customer, but operations staff need “all pending orders for warehouse 7.” A GSI can use `WAREHOUSE#7` as its partition key and status/time as its sort key. The requirement—not a desire to add every searchable attribute—justifies the index.

Indexes introduce tradeoffs: each projected item consumes storage, and writes to the base table must update relevant indexes. A GSI can also have a hot key independent of the base table.

### Read consistency

Eventually consistent reads are the default and cost less read capacity than strongly consistent reads of the same item size. Strongly consistent reads are available on a table and an LSI when the request requires the latest committed value. GSI and stream reads are eventually consistent.

DynamoDB global tables provide managed multi-Region, multi-active replication. Current global tables support different consistency modes; the default multi-Region eventual consistency mode replicates changes asynchronously across Regions, while multi-Region strong consistency is available only where its documented requirements are satisfied. In an exam scenario, do not assume that adding another Region magically preserves every consistency and latency property—use the mode stated in the question.

When two writers might update one item concurrently, conditional expressions or DynamoDB transactions can protect invariants. Atomic counters, conditional writes, idempotency keys, and version attributes are often better tools than hoping requests arrive in order.

### Capacity modes

| Mode | Choose it when | Watch for |
| --- | --- | --- |
| On-demand | Traffic is new, unpredictable, or spiky and operational simplicity matters | Per-request economics at sustained high volume; instant jumps far beyond prior peaks still require sound key distribution and planning |
| Provisioned | Traffic is steady or forecastable and capacity economics matter | Configure read/write capacity and optionally target-tracking auto scaling |

Both modes still need good keys. “Serverless” does not make a single hot partition key infinitely scalable.

### DynamoDB features that reveal the intended answer

- **Time to Live (TTL):** mark items for asynchronous expiration without application-driven delete sweeps. Expiration is not immediate, so do not use TTL as a precise scheduler or authorization boundary.
- **DynamoDB Streams:** ordered change records per item for event-driven processing, replication workflows, or materialized views. Pair with Lambda when the scenario asks to react to item changes.
- **Point-in-time recovery (PITR):** continuous recovery protection for accidental writes or deletes. Global replication is not a backup because bad changes can replicate.
- **Global tables:** multi-Region, multi-active access for geographically distributed applications.
- **DynamoDB Accelerator (DAX):** DynamoDB-compatible, in-memory caching for read-heavy workloads that can tolerate cache consistency behavior. DAX is not a relational cache and is not useful for write-only pressure.

## Caching: remove work, do not move correctness into the cache

A cache helps when the same expensive result is requested repeatedly and some amount of staleness is acceptable. It is not automatically useful for unique queries, write-heavy flows, or data that must always reflect the latest committed value.

### ElastiCache, DAX, and MemoryDB

| Requirement | Best fit | Reason |
| --- | --- | --- |
| Cache relational query results, API responses, sessions, counters, or arbitrary objects | Amazon ElastiCache | Managed Valkey-, Redis OSS-, or Memcached-compatible in-memory cache |
| Add a DynamoDB API-compatible read cache with minimal application logic change | DynamoDB Accelerator (DAX) | Purpose-built write-through cache for DynamoDB |
| Use a Redis-compatible database as the durable primary store | Amazon MemoryDB | Durable Multi-AZ database rather than a disposable cache |
| Cache static web objects near viewers | CloudFront | Edge cache; avoids routing global asset requests to the database tier |

Two common application patterns are worth recognizing.

**Cache-aside (lazy loading)**

```text
read key
  │
  ├─ cache hit ───────────────→ return value
  │
  └─ cache miss → read database → populate cache → return value
```

Only requested data enters the cache, but the first request is a miss and stale entries require expiration or invalidation.

**Write-through**

The application updates the cache as data is written to the durable store. Reads are more likely to hit, but the design does extra write work and must define failure ordering. Neither pattern absolves you from choosing a TTL, eviction behavior, and acceptable staleness.

For sessions, ask whether losing cached state is acceptable. ElastiCache is a strong shared-session answer when application servers must remain stateless, but business records that cannot be recreated still belong in a durable database.

## Purpose-built databases and analytical stores

The exam often places one decisive phrase in the scenario. Learn the phrase, but also understand the access pattern behind it.

### DocumentDB

Amazon DocumentDB is designed for JSON-like documents and MongoDB-compatible workloads. It fits catalogs, profiles, and content whose attributes vary between documents. Compatibility makes migration easier, but it is not a promise that every MongoDB feature, version behavior, or extension is identical. Validate compatibility when migration requirements are specific.

### Neptune

Neptune is for highly connected data when the relationship itself is the query: shortest paths, friends-of-friends, knowledge graphs, network dependencies, and fraud rings. A relational database can store edges, but repeated joins for variable-depth traversal become awkward and expensive. “Social network” alone is not enough—the question should actually require graph traversal.

### Timestream

Amazon Timestream is optimized for time-series data such as IoT readings, application telemetry, and industrial measurements. Its model and functions favor time-window queries, changing retention needs, and high-volume timestamped ingestion. If the scenario only stores a modest number of ordinary business timestamps, a relational database may remain simpler.

### OpenSearch Service

Amazon OpenSearch Service fits full-text search, relevance ranking, autocomplete, and interactive log analytics. A common architecture writes authoritative product records to a durable database, then asynchronously indexes searchable fields in OpenSearch. Search results may be briefly stale; the source database remains the system of record.

### Redshift versus an operational database

Amazon Redshift is a columnar data warehouse for online analytical processing (OLAP): scans, aggregations, and business intelligence across large datasets. RDS, Aurora, and DynamoDB serve online transaction processing (OLTP): many short application requests.

| OLTP | OLAP |
| --- | --- |
| Small reads and writes, high concurrency | Large scans and aggregations |
| Current operational state | Historical, integrated data |
| Millisecond user requests | Analyst and dashboard queries |
| RDS, Aurora, DynamoDB | Redshift; sometimes Athena over S3 |

Do not run a day's revenue aggregation across the production orders database if the scenario offers a warehouse or data-lake path. Likewise, do not use Redshift as the checkout transaction database.

## Decode common exam scenarios

### “A relational database must survive an AZ failure”

Choose an RDS Multi-AZ deployment or an appropriate Aurora cluster. The requirement is failover, not reporting capacity. Add read replicas only if the scenario separately asks for read scaling.

### “The read-heavy reporting workload slows the writer”

Add read replicas and direct read-only/reporting traffic to them. If immediate read-after-write visibility is mandatory, account for replication lag; a normal asynchronous replica can return stale data.

### “Millions of requests use a predictable user ID and timestamp”

DynamoDB with a well-distributed user partition key and timestamp-based sort key is a natural fit. Use a GSI for a second known lookup. Do not propose a table scan plus filter.

### “Lambda overwhelms an otherwise healthy relational database”

Look for connection exhaustion. Put RDS Proxy between the Lambda functions and RDS/Aurora, control application concurrency where appropriate, and still optimize queries. ElastiCache is relevant only if repeated reads are actually cacheable.

### “Users around the world need local writes”

For key-value access, DynamoDB global tables are a likely answer. For relational workloads, examine Aurora Global Database or a newer distributed relational option only if its exact consistency, write-topology, compatibility, and regional requirements match the question. A cross-Region read replica alone does not make both Regions active writers.

### “The response must be faster, with minimal database changes”

Identify the repeated work. DAX fits DynamoDB item reads; ElastiCache fits reusable application objects or relational results; CloudFront fits cacheable web responses near users. “Add a cache” is incomplete unless you can name the cache key and tolerated staleness.

## Distractor detector

Watch for these plausible but incorrect statements:

- **“Multi-AZ doubles read capacity.”** Not for the classic RDS Multi-AZ DB instance deployment; its standby does not serve reads.
- **“A read replica is a backup.”** It can replicate accidental changes and is built primarily for reads or replication-based recovery patterns.
- **“DynamoDB can query any attribute efficiently.”** Efficient requests require a matching table key or secondary index.
- **“A filter makes Scan cheap.”** Filtering happens after DynamoDB reads candidate items.
- **“A GSI supports strong reads.”** GSI reads are eventually consistent.
- **“TTL deletes at the exact expiration second.”** TTL cleanup is asynchronous.
- **“Serverless removes every limit.”** It removes server management, not key-design, connection, quota, consistency, or workload-shape constraints.
- **“OpenSearch is the source of truth.”** It is usually a derived search index backed by a durable operational store.
- **“One database keeps the architecture simple.”** One service is simpler only while it still meets every access pattern without fragile workarounds.

## A repeatable selection method

On exam day, use this compact sequence:

```text
1. Circle the nouns: orders, sessions, edges, events, documents.
2. Underline the verbs: join, traverse, search, aggregate, get by key.
3. Mark the quality words: strongly consistent, sub-millisecond,
   unpredictable, multi-Region, minimal operations.
4. Choose the data model and primary service.
5. Add exactly one feature for the named pressure:
   HA → Multi-AZ / failover target
   read scale → replicas / reader endpoint
   connections → RDS Proxy
   repeated reads → cache
   alternate DynamoDB lookup → GSI
   regional access → explicitly multi-Region design
6. Reject any answer that solves a problem the question did not ask about.
```

The best answer often contains two layers: a durable system of record plus a purpose-built read path. That is not unnecessary complexity when the scenario explicitly has two different access patterns.

## Check your understanding

<details>
<summary>1. An RDS for PostgreSQL database must automatically recover from an Availability Zone outage. Reporting traffic is not mentioned. What should you add?</summary>
<p><strong>Answer:</strong> Use an RDS Multi-AZ deployment. The requirement is high availability and automatic failover. A read replica primarily addresses read scale and does not replace the Multi-AZ HA mechanism.</p>
</details>

<details>
<summary>2. A DynamoDB table uses customerId as its partition key. The application must efficiently list all orders for one customer between two dates. What key change best supports that request?</summary>
<p><strong>Answer:</strong> Use a composite key with the customer identifier as the partition key and a sortable order date (usually combined with a unique order identifier) as the sort key. Then use Query with an equality condition on the partition key and a range condition on the sort key.</p>
</details>

<details>
<summary>3. A team scans a DynamoDB table and filters for status = PENDING. The table is growing and the request consumes too much capacity. What is the architectural fix?</summary>
<p><strong>Answer:</strong> Create an access pattern backed by a key—commonly a GSI whose partition key represents the queried status or a better-distributed status grouping, with an appropriate sort key. A FilterExpression does not reduce the items read by the scan, and a low-cardinality status key may need write sharding to avoid hot traffic.</p>
</details>

<details>
<summary>4. Hundreds of Lambda invocations open short-lived connections to Aurora and exhaust the database connection limit. Which service directly targets this issue?</summary>
<p><strong>Answer:</strong> Amazon RDS Proxy. It pools and reuses database connections. A larger instance might raise the ceiling, and a cache might reduce some reads, but neither directly manages the connection storm.</p>
</details>

<details>
<summary>5. An ecommerce site needs transactional order writes and typo-tolerant, relevance-ranked product search. Must one database do both jobs?</summary>
<p><strong>Answer:</strong> No. Keep orders and authoritative product records in a relational or otherwise suitable durable operational database, then maintain a searchable projection in Amazon OpenSearch Service. Each store serves a different access pattern.</p>
</details>

<details>
<summary>6. A global shopping-cart service needs key-based local reads and writes in several Regions. Which option is the strongest starting point?</summary>
<p><strong>Answer:</strong> DynamoDB global tables. They provide managed multi-Region, multi-active replication. The design must still choose and understand the available consistency mode, conflict behavior, key distribution, and recovery strategy.</p>
</details>

## Final takeaways

- Choose from the **request shape**, then verify consistency, scale, availability, and operations.
- RDS and Aurora serve relational transactions; DynamoDB rewards known key-based access patterns.
- Multi-AZ, read replicas, cross-Region replication, and backups solve different failure or scale problems.
- DynamoDB performance begins with partition-key distribution and `Query`, not `Scan` plus a filter.
- Cache only reusable data with an explicit staleness policy; keep irreplaceable state in a durable store.
- Redshift, OpenSearch, Neptune, Timestream, and DocumentDB are correct when their specialized access pattern is actually present.

For further review, use the official AWS guides on [choosing a database service](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/databases-on-aws-how-to-choose.html), [RDS Multi-AZ deployments](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html), and [DynamoDB read consistency](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.ReadConsistency.html).
