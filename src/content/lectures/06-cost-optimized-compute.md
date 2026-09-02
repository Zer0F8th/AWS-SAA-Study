---
title: "Cost-Optimized Compute Without Fragile Architecture"
description: "Right-size the compute model, match commitments to the baseline, and use Spot and elasticity safely for AWS SAA scenarios."
order: 6
domain: cost
publishedAt: 2026-09-02
difficulty: Associate
tags:
  - EC2
  - Lambda
  - Fargate
  - Spot
  - Savings Plans
  - Auto Scaling
objectives:
  - "Choose among EC2, Lambda, and container compute from workload shape and operating model."
  - "Match On-Demand, Savings Plans, Reserved Instances, and Spot capacity to the correct usage layer."
  - "Apply right-sizing, Graviton, Auto Scaling, and scheduling without violating availability requirements."
  - "Recognize when a capacity guarantee and a pricing discount solve different problems."
featured: false
draft: false
---

The cheapest instance is not automatically the most cost-optimized architecture. If it misses latency targets, loses irreplaceable work during an interruption, or requires a large operations team, it may cost more overall.

AWS exam questions treat cost optimization as a constrained problem:

```text
minimize total cost
subject to: performance + availability + recovery + operational requirements
```

That phrase **"with no decrease in availability"** is doing real work. It prevents you from choosing a single tiny instance simply because its hourly price is lower.

> **Exam lens:** First remove idle and oversized capacity. Then cover the stable baseline with a commitment. Finally, use elastic or interruptible capacity for the variable layer.

## Read the workload shape before the price sheet

You need four facts before selecting a compute model:

1. **Duration:** milliseconds, minutes, hours, or continuously running?
2. **Demand:** steady, scheduled, unpredictable, or queue-driven?
3. **Interruptibility:** can a request or job be retried from a checkpoint?
4. **Control:** does the team need a host OS, a container boundary, or only a function runtime?

The answer often falls out of the timeline:

```text
requests
  ^                    burst
  |                    /\
  |       baseline ___/  \____
  |  ____/                    \____
  +------------------------------------> time

     stable base: commitment / right-sized capacity
     variable load: Auto Scaling or serverless
     retryable batch: candidate for Spot
```

Do not buy a three-year commitment for the peak. Commitments are valuable only when you can consume them consistently.

## Choose the compute abstraction first

| Compute choice | Cost-efficient when | Watch for |
| --- | --- | --- |
| AWS Lambda | Event-driven, intermittent, short-running work with automatic scaling | Duration, invocation volume, memory sizing, concurrency, and service limits |
| ECS or EKS on AWS Fargate | Containers need task-level resources without managing EC2 hosts | Continuously busy fleets may justify comparing EC2 capacity; size each task correctly |
| ECS or EKS on EC2 | The fleet is steady enough to pack containers efficiently and the team accepts host management | Idle nodes, patching, scaling, and bin-packing efficiency |
| Amazon EC2 | Full OS control, specialized hardware, legacy software, or sustained workloads | Idle time, overprovisioning, licensing, and purchase-option selection |
| AWS Batch | Queued batch jobs whose infrastructure should scale with demand | Job retry/checkpoint design and the chosen compute environment |

### Lambda: pay for execution, not idle servers

Lambda is compelling when work arrives irregularly. It removes the need to keep instances running between events and scales per demand. It is not "free compute," and it is not automatically cheaper for a high, continuous load.

Lambda allocates CPU in proportion to configured memory. Therefore, the lowest memory setting is not guaranteed to produce the lowest bill. A CPU-bound function with more memory may finish much faster, lowering or barely changing total duration cost. Measure several settings with realistic invocations.

A useful mental model is:

```text
function cost ~= request cost + (configured memory x billed duration)
```

Architecture also matters. If dependencies support Arm, test the `arm64` option backed by AWS Graviton. AWS positions it for better price-performance than equivalent `x86_64` Lambda execution, but compatibility must be verified for packages, layers, extensions, and container images.

**Strong Lambda clues:** API event processing, object-upload transformation, EventBridge schedules, DynamoDB stream consumers, bursty automation, and no need for a persistent server process.

**Weak Lambda clues:** jobs beyond the service's execution limit, software requiring deep host control, continuously saturated compute where another model has better economics, or a stateful process that assumes a stable local machine.

### Fargate: optimize people time and task utilization

Fargate runs containers without the team provisioning or patching worker nodes. You specify task CPU and memory. It is often the cost-oriented answer when operational overhead is important and workloads scale at the task level.

EC2-backed containers may be more economical when a large, predictable fleet stays busy and the organization can operate and pack the nodes efficiently. The tradeoff is not "containers vs. servers"; both options run containers. It is **managed task capacity vs. managed-by-you host capacity**.

### EC2: control creates optimization options and obligations

EC2 is appropriate when the workload needs a particular instance family, GPU, local instance store, custom kernel or agent, licensed software, or a long-running host. Its cost is then optimized with four levers:

- Select the correct **family**: compute-, memory-, storage-, or accelerated-computing optimized.
- Select the correct **size** from observed utilization, not a guessed peak.
- Select the correct **architecture**, including Graviton where the application is compatible.
- Select the correct **purchase option** for each layer of demand.

## Purchase options: discount, flexibility, and capacity are different axes

| Option | Best match | Commitment / interruption | Exam-defining fact |
| --- | --- | --- | --- |
| On-Demand | New, short-lived, unpredictable, or uncommitted workload | No long commitment; not interruptible by the Spot service | Maximum purchasing flexibility |
| Compute Savings Plans | Predictable spend but architecture, family, Region, or compute service may change | Commit to a USD-per-hour usage amount for 1 or 3 years | Applies flexibly across eligible EC2, Fargate, and Lambda usage |
| EC2 Instance Savings Plans | Predictable EC2 usage in an instance family and Region | 1- or 3-year hourly spend commitment | Less flexible than Compute Savings Plans, generally a deeper discount |
| Reserved Instances | Stable EC2 configuration; Standard or Convertible flexibility choices | 1- or 3-year term | Primarily a billing construct; a zonal RI also reserves matching capacity |
| Spot Instances | Fault-tolerant, flexible workloads | Capacity can be interrupted | Deep discount in exchange for interruption risk |
| On-Demand Capacity Reservation | Capacity must be available in a specific AZ | Reserve capacity without a long pricing commitment | Capacity assurance by itself is **not** a discount |
| Dedicated Host | Compliance or server-bound licensing requires a physical host | Dedicated physical server | Can reduce license cost for eligible bring-your-own-license scenarios, but not a generic savings choice |

### Savings Plans vs. Reserved Instances

Both reduce eligible compute charges in exchange for commitment. The wording tells you which flexibility is valuable.

- Choose a **Compute Savings Plan** when usage is steady but the implementation may move across EC2 families, sizes, operating systems, tenancies, Regions, or from EC2 to Fargate/Lambda.
- Choose an **EC2 Instance Savings Plan** when the Region and instance family are stable but size, OS, or tenancy may vary within that scope.
- Think of a **Standard RI** for a stable, specific EC2 configuration and stronger discount, and a **Convertible RI** when instance attributes may need to change in exchange for less discount.

Savings Plans do not make an instance available during an AZ capacity shortage. That is a separate capacity problem.

> **Trap:** "The workload cannot fail to launch" is not solved merely by buying a discount. A Capacity Reservation (or the capacity benefit of the applicable zonal RI) addresses availability of EC2 capacity; a Savings Plan addresses price.

### Commit only to the measured baseline

Assume a service needs at least 12 instance-equivalents all year, normally runs 18, and reaches 40 during a monthly event. A defensible layered plan is:

```text
0 -------- 12 ---------------- 18 --------------------- 40
| committed baseline          | variable normal load   | rare peak
| Savings Plan / RI           | On-Demand or mix       | elastic/Spot if safe
```

Committing to 40 would waste the discount whenever only 12–18 units run. The goal is high **commitment utilization**, not the largest advertised percentage reduction.

## Spot: redesign for interruption, do not merely change the price flag

Spot uses spare EC2 capacity and may be interrupted when AWS needs that capacity back. It is a powerful cost lever for:

- Queue-based workers whose messages become visible again if processing fails
- Batch, rendering, CI, testing, data processing, and stateless web capacity
- Distributed systems that already replace failed nodes
- Jobs that checkpoint progress to durable storage

It is a poor fit for a single stateful server, an irreplaceable in-memory calculation, or any task that cannot recover within the business deadline.

A resilient Spot design has several layers:

1. Put work in SQS, AWS Batch, or another durable scheduler.
2. Make work idempotent so a retry does not corrupt results.
3. Checkpoint progress to S3, a database, or another durable service.
4. Diversify across instance types and Availability Zones.
5. Use a mixed-instances Auto Scaling group where a stable On-Demand base is required.
6. Prefer the **price-capacity-optimized** Spot allocation strategy when selecting among pools.
7. Enable Capacity Rebalancing and handle rebalance recommendations/interruption notices gracefully.

An example distribution might preserve a reliable base and use Spot above it:

```json
{
  "InstancesDistribution": {
    "OnDemandBaseCapacity": 2,
    "OnDemandPercentageAboveBaseCapacity": 25
  }
}
```

This is an architectural illustration, not a universal ratio. The correct percentage comes from the application's tolerance for lost capacity.

> **Trap:** A Spot interruption notice is a chance to drain or checkpoint; it is not enough time to begin copying a huge stateful dataset. Recovery must be designed before the notice arrives.

## Auto Scaling: the cheapest idle instance is the one you did not launch

Auto Scaling aligns active capacity with demand and replaces unhealthy instances. The exam distinguishes policy types by the signal in the requirement.

| Demand statement | Policy or mechanism | Why |
| --- | --- | --- |
| "Keep average CPU near 50%" | Target tracking | Maintains a metric near a target |
| "Add capacity at these thresholds" | Step scaling | Applies defined adjustments by alarm magnitude |
| "Traffic rises every weekday at 08:00" | Scheduled scaling | Capacity changes on a known timetable |
| "Forecast recurring demand from history" | Predictive scaling | Prepares capacity from learned patterns |
| "Workers process an SQS backlog" | Target tracking on backlog per instance | Scales from work, not an indirect CPU symptom |

Choose a metric that represents demand. CPU can be misleading for I/O-bound services. For a queue consumer, **backlog per healthy worker** often maps more directly to the capacity needed to meet processing time.

Scaling is constrained by startup time. If instances take ten minutes to become useful but the traffic spike lasts five minutes, reactive scaling alone will always be late. A scheduled or predictive action, a warm pool, or a serverless design may satisfy the performance requirement with less permanent idle capacity.

### Separate stateless compute from state

Auto Scaling works best when instances are disposable:

```text
Route 53 / CloudFront
          |
         ALB
       /  |  \
   EC2  EC2  EC2       <- replaceable, no unique local state
          |
     durable state
   S3 / RDS / DynamoDB / EFS
```

If user sessions or uploaded files live only on an instance, scaling in becomes a data-loss event. Externalize sessions and durable data so the group can add, replace, and remove capacity economically.

## Right-size with evidence

Right-sizing is continuous, not a one-time launch decision. Use CloudWatch metrics and AWS Compute Optimizer recommendations to find instances that are overprovisioned or use the wrong family. Compute Optimizer analyzes resource configuration and utilization history and can recommend alternatives with estimated pricing.

Measure more than average CPU:

| Signal | What it can reveal |
| --- | --- |
| CPU percent and steal/saturation symptoms | Too many or too few vCPUs; wrong family |
| Memory utilization from the CloudWatch agent | Memory-bound workload or oversized RAM |
| Network packets and throughput | Network-bound instance-family limit |
| EBS bandwidth, IOPS, queue, and latency | Storage bottleneck mistakenly blamed on CPU |
| p95/p99 application latency | User-facing impact hidden by averages |
| Auto Scaling desired vs. in-service capacity | Slow launches, unhealthy churn, poor policy settings |

Downsizing until average utilization looks high can erase failure headroom. A multi-AZ service should still meet its target when an instance or AZ is unavailable. Right-size against the stated resilience model and tail latency, not only the monthly mean.

### Schedule non-production resources

Development, test, training, and reporting instances frequently sit idle outside working hours. If their state allows it, stop or scale them down on a schedule. Remember the billing boundary:

- Stopping an EBS-backed instance stops its instance compute charge.
- Attached EBS volumes and retained public IPv4 addresses or other resources can continue to incur charges.
- Terminating an instance may delete volumes configured with `DeleteOnTermination`; verify retention requirements first.

"Stop it at night" is useful, but it is not the same as "the environment costs zero at night."

## Worked exam scenarios

### Scenario 1: stable baseline, unpredictable promotions

An online store uses EC2 all year. Twelve instances are continuously busy; promotions create unpredictable bursts. The application can use several compatible instance sizes but cannot tolerate interruption for checkout traffic.

**Choose:** Cover the measured baseline with an appropriate Savings Plan, and use an Auto Scaling group with On-Demand capacity for unpredictable bursts. Do not buy the commitment at peak size, and do not force checkout onto Spot merely to lower the bill.

### Scenario 2: nightly image conversion

Millions of independent images wait in S3. Jobs can retry, write results back to S3, and have a generous completion window.

**Choose:** A queue- or AWS Batch-driven fleet using diversified Spot capacity is a strong option. Checkpoint at object boundaries, make each conversion idempotent, and let failed messages retry. Lambda may also fit if each conversion stays within its runtime/resource limits; the question's details decide.

### Scenario 3: sporadic event handler

A function validates a few hundred uploaded documents most days, with occasional bursts. There is no work between uploads and each validation lasts seconds.

**Choose:** S3 event notification to Lambda. Per-event scaling avoids paying for idle instances. Tune memory with measurements instead of assuming 128 MB is cheapest.

### Scenario 4: containers with a small operations team

A startup runs variable microservice traffic in containers and explicitly wants to avoid managing or patching worker nodes.

**Choose:** ECS on Fargate with service auto scaling. ECS on EC2 might lower raw compute cost at high steady utilization, but violates the operational requirement in this scenario.

### Scenario 5: guaranteed launch for a one-day event

A live event needs EC2 capacity in one specific AZ and begins tomorrow. The team cannot accept a capacity error and does not want a multi-year pricing commitment.

**Choose:** An On-Demand Capacity Reservation for the event window. A Savings Plan discounts eligible usage but does not reserve AZ capacity.

## Common distractors

| Distractor | Why it fails |
| --- | --- |
| Buy Reserved Instances for every historical peak | Converts rare bursts into a constant financial commitment |
| Put a single production database on Spot | Interruption and state make it a poor fit unless the database technology explicitly provides resilient replacement |
| Select the smallest Lambda memory | Less memory also means less CPU; longer duration can offset the apparent saving |
| Scale only from average CPU | It may not represent queue depth, latency, memory, or I/O pressure |
| Buy a Savings Plan to guarantee launch capacity | Pricing commitment and capacity reservation are separate concepts |
| Use one Spot instance type in one AZ | A single capacity pool increases interruption and fulfillment risk |
| Move to Fargate because it is always cheaper | Fargate optimizes operations and task-level elasticity; economics still depend on utilization and sizing |

## Check your understanding

<details>
<summary><strong>1. A company has steady EC2 spend but expects to migrate some services to Lambda and Fargate and may change Regions. Which commitment is the best clue match?</strong></summary>

A Compute Savings Plan. It exchanges some discount depth for flexibility across eligible EC2 usage, Fargate, and Lambda, including broader EC2 configuration and Region flexibility. An EC2 Instance Savings Plan is narrower.
</details>

<details>
<summary><strong>2. Why might doubling Lambda memory reduce total cost?</strong></summary>

Lambda increases CPU with memory. If a CPU-bound invocation finishes in less than half the time, the higher per-duration resource allocation can be offset by the shorter billed duration. Benchmark the real function; do not assume the result.
</details>

<details>
<summary><strong>3. A fault-tolerant worker fleet has a minimum requirement of four always-available instances and can retry all additional work. How should the purchase mix begin?</strong></summary>

Use an On-Demand base capacity sufficient for the non-interruptible minimum, then consider diversified Spot capacity above that base. A commitment may discount the steady On-Demand baseline if its long-term utilization is established.
</details>

<details>
<summary><strong>4. A one-week workload needs guaranteed capacity in a particular AZ. Why is a three-year Savings Plan incomplete?</strong></summary>

The need is capacity assurance, not only a lower usage rate. An On-Demand Capacity Reservation can reserve EC2 capacity in that AZ without forcing a long pricing commitment. Any discount decision is evaluated separately.
</details>

<details>
<summary><strong>5. CPU stays at 20%, but requests miss their latency objective whenever EBS queue length rises. Should the team downsize EC2 based on CPU?</strong></summary>

No. The service is showing a storage-path bottleneck, and a smaller instance could reduce EBS bandwidth further. Inspect volume configuration, instance EBS limits, queue depth, and application I/O before changing compute size.
</details>

## Final recall

```text
1. Pick the abstraction: function, task, or host.
2. Right-size from measured CPU, memory, network, storage, and latency.
3. Make state durable and compute disposable.
4. Commit only to the stable baseline.
5. Autoscale the variable layer.
6. Use Spot only where interruption is designed in.
7. Treat a capacity guarantee separately from a billing discount.
```

The strongest cost answer is usually a **portfolio**, not one purchasing option everywhere: commitments for the known floor, On-Demand flexibility where failure is unacceptable, and Spot or serverless elasticity where the workload can absorb it.

### AWS documentation

- [Amazon EC2 billing and purchasing options](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-purchasing-options.html)
- [Savings Plans types](https://docs.aws.amazon.com/savingsplans/latest/userguide/plan-types.html)
- [Compute Savings Plans and Reserved Instances](https://docs.aws.amazon.com/savingsplans/latest/userguide/sp-ris.html)
- [Auto Scaling allocation strategies](https://docs.aws.amazon.com/autoscaling/ec2/userguide/allocation-strategies.html)
- [Capacity Rebalancing for Spot](https://docs.aws.amazon.com/autoscaling/ec2/userguide/ec2-auto-scaling-capacity-rebalancing.html)
- [Configure Lambda memory](https://docs.aws.amazon.com/lambda/latest/dg/configuration-memory.html)
- [Selecting Lambda instruction-set architecture](https://docs.aws.amazon.com/lambda/latest/dg/foundation-arch.html)
- [EC2 recommendations from AWS Compute Optimizer](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-recommendations.html)
