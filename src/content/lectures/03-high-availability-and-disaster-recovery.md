---
title: "Multi-AZ is not disaster recovery."
description: "Design for component and Availability Zone failure, then choose a separate recovery strategy from the required RTO and RPO."
order: 3
domain: resilient
publishedAt: 2026-09-02
difficulty: Associate
tags: ["multi-az", "disaster-recovery", "route-53", "rto-rpo"]
objectives:
  - "Separate high availability, fault tolerance, backup, and disaster recovery"
  - "Choose a recovery pattern from RTO, RPO, and cost constraints"
  - "Distinguish Multi-AZ failover from read scaling and cross-Region recovery"
featured: true
draft: false
---

High availability handles expected component failure without turning it into a business outage. Disaster recovery handles the larger event that defeats the primary environment.

They reinforce each other, but they are not synonyms. A Multi-AZ database can survive an Availability Zone failure and still replicate a bad write immediately. A backup can preserve yesterday's correct data and still take hours to restore. The exam rewards the design that matches the failure being discussed.

> **Exam signal:** Find the failure boundary first—instance, AZ, Region, or corrupted data—then use RTO and RPO to decide how much standby infrastructure the business is paying for.

## Name the reliability requirement

| Term | The useful question | Example mechanism |
| --- | --- | --- |
| High availability | Can the service continue after ordinary component failure? | Load balancer and healthy targets in multiple AZs |
| Fault tolerance | Can it continue with little or no interruption? | Redundant active components with automatic failover |
| Backup | Can an earlier version of data be recovered? | Versioning, snapshots, AWS Backup |
| Disaster recovery | Can the workload be restored after a site or Region-level event? | Cross-Region copies and a tested recovery environment |

No single AWS badge makes a whole system highly available. An Application Load Balancer across three AZs does not help if every target uses one database in one AZ. An Auto Scaling group cannot recreate state stored only on an instance store volume.

Trace the dependency chain and find the narrowest failure boundary.

```text
Route 53
  → load balancer across AZs
    → stateless compute across AZs
      → Multi-AZ data tier
        → durable backups / cross-Region recovery copy
```

## Multi-AZ and read replicas solve different problems

For Amazon RDS, a Multi-AZ deployment maintains a synchronous standby for availability. The service can fail over to the standby; the standby is not the normal endpoint for serving application reads.

A read replica uses asynchronous replication and primarily scales reads. Depending on the engine and design, it can also support a recovery plan, but promotion is a separate action and replication lag means it does not offer the same semantics as synchronous Multi-AZ failover.

| Requirement | Prefer |
| --- | --- |
| Automatic failover after an AZ or DB instance failure | RDS Multi-AZ |
| Offload read-heavy queries | Read replica |
| Read capacity in another Region | Cross-Region read replica where supported |
| Recover a previous point in time | Automated backups / point-in-time recovery |

Aurora stores copies of data across multiple AZs and separates its cluster storage from database instances. Adding Aurora Replicas across AZs improves read scale and gives the cluster failover targets. Aurora Global Database adds cross-Region replication for globally distributed reads and regional recovery designs.

> **Exam trap:** Multi-AZ is an availability choice, not a read-scaling feature and not protection from accidental deletion. Read the required outcome, not just the word “database.”

## RTO and RPO price the recovery plan

**Recovery time objective (RTO)** is how long the workload may be unavailable. **Recovery point objective (RPO)** is how much recent data the business may lose, measured in time.

A requirement of “restore within 15 minutes with less than 5 minutes of data loss” means RTO = 15 minutes and RPO = 5 minutes. Shorter objectives demand more automation, more frequent or continuous replication, and usually more running infrastructure.

| Strategy | Standby shape | Relative cost | Typical recovery profile |
| --- | --- | --- | --- |
| Backup and restore | Backups only | Lowest | Longest RTO; RPO follows backup frequency |
| Pilot light | Core data services running | Low–medium | Scale application layers during recovery |
| Warm standby | Reduced-capacity full stack | Medium–high | Scale an already functional environment |
| Multi-site active/active | Full stack serves traffic | Highest | Shortest RTO; demanding data consistency design |

These are patterns, not guaranteed time values. The scenario's numbers and operational constraints decide the answer.

### Backup and restore

Copy backups to another Region and, when required, another account. Recreate infrastructure from code, restore data, validate, and redirect traffic. This fits generous recovery objectives and strong cost pressure.

### Pilot light

Keep the critical data plane—such as replicated databases—ready in the recovery Region. Compute and presentation layers are defined but mostly off. During recovery, start and scale them around the live data core.

### Warm standby

Run every tier in the recovery Region at reduced capacity. Because the stack already processes health checks and can be exercised, recovery mainly means scaling and redirecting traffic.

### Active/active

Multiple Regions serve production traffic. This can minimize interruption, but multi-Region writes, conflict resolution, session state, deployment coordination, and observability make it the most complex answer. Choose it only when the business requirement justifies it.

## Route traffic deliberately

Route 53 health checks and routing policies often complete a recovery design:

- **Failover routing** sends traffic to a secondary resource when the primary is unhealthy.
- **Latency routing** sends users to the Region with the lowest measured latency.
- **Weighted routing** shifts a controlled percentage of traffic, useful for migrations and releases.
- **Geolocation routing** selects an answer based on the user's geographic origin.

DNS failover is not instantaneous. Resolver caching and DNS TTL affect how quickly clients receive a new answer. Global Accelerator is an alternative when the scenario needs static anycast IP addresses and rapid health-based traffic movement over the AWS global network.

## Design graceful degradation

Resilience is not only duplication. Loose coupling limits how far a failure travels.

- Put SQS between a producer and a worker fleet so bursts or worker failure do not reject accepted work.
- Send repeatedly failing messages to a dead-letter queue after an appropriate receive count.
- Make consumers idempotent because standard queues and retries can deliver a message more than once.
- Use timeouts, capped retries with backoff and jitter, and circuit breakers so a slow dependency does not consume every worker.
- Keep application compute stateless; put sessions and durable state in shared services.

An architecture that retries forever can turn a small outage into a retry storm. An architecture that stores no state on replaceable compute can heal by replacing that compute.

## Walk through a scenario

A regional retail application already uses an Application Load Balancer, Auto Scaling across three AZs, and RDS Multi-AZ. The business now requires recovery from a Region outage within one hour, with no more than five minutes of lost orders. Paying for two full production stacks is unacceptable.

The existing design covers instance and AZ failure but not the stated regional boundary. Backup and restore is cheap, but restoring and validating everything may miss the one-hour RTO. Active/active meets time but violates the cost signal.

A strong answer is a **pilot light or warm standby**, depending on the options provided:

1. Replicate the data layer across Regions with a mechanism that can meet the five-minute RPO.
2. Define the application stack as infrastructure as code in the recovery Region.
3. Run at least the components required by the selected pattern.
4. Copy immutable artifacts, configuration, secrets, and backups cross-Region.
5. Use health-aware traffic failover and test the runbook regularly.

If the prompt stresses that every tier must already be running and tested, choose warm standby. If only the core data services remain live until recovery begins, choose pilot light.

## Check your understanding

<details>
<summary>An RDS database is Multi-AZ, but an operator accidentally deletes rows. Why is the standby not the recovery copy?</summary>

Multi-AZ synchronously replicates changes for availability, so the deletion is replicated too. Recover the correct point in time from automated backups or another protected copy. Availability replication protects against infrastructure failure; versioned backups protect against unwanted state changes.

</details>

## Takeaways

- Match the architecture to the failure boundary: resource, AZ, Region, or data corruption.
- Multi-AZ improves availability; read replicas primarily improve read scale; backups recover old state.
- RTO measures downtime. RPO measures tolerable data loss.
- Backup/restore, pilot light, warm standby, and active/active trade increasing cost for faster recovery.
- Remove single-AZ dependencies from every critical tier, not only compute.
- A recovery plan is not real until the organization has exercised it and measured the result.

## Sources

- [AWS Disaster Recovery of Workloads whitepaper](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html)
- [Reliability Pillar: plan for disaster recovery](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/plan-for-disaster-recovery-dr.html)
- [Amazon RDS high availability](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html)
- [Route 53 routing policies](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-policy.html)
