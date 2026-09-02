---
title: "Choose Storage by I/O Pattern"
description: "Turn workload clues about latency, throughput, sharing, and durability into the right S3, EBS, EFS, instance store, or FSx choice."
order: 4
domain: performance
publishedAt: 2026-09-02
difficulty: Associate
tags:
  - S3
  - EBS
  - EFS
  - FSx
  - storage
objectives:
  - "Classify a requirement as object, block, or file storage before comparing products."
  - "Distinguish IOPS-bound, throughput-bound, latency-sensitive, and highly concurrent workloads."
  - "Select an EBS volume type and recognize the instance-level bottlenecks around it."
  - "Choose between EFS, FSx, S3, and instance store from protocol and resilience clues."
featured: true
draft: false
---

Storage questions become much easier when you stop memorizing product names and start reading the **I/O shape**. The exam rarely asks which service is "best" in isolation. It describes an application: perhaps thousands of small random writes, a fleet of Linux servers sharing files, or a temporary shuffle stage that can be rebuilt. Your job is to translate those words into a storage interface and a performance requirement.

> **Exam lens:** Decide **object vs. block vs. file first**. Then optimize latency, IOPS, throughput, concurrency, and failure scope. A fast answer to the wrong interface is still wrong.

## Start with the storage interface

The interface is the most powerful eliminator in the question.

| Requirement in the prompt | Interface | Leading AWS choice | Important boundary |
| --- | --- | --- | --- |
| Objects addressed by key; HTTP API; massive scale | Object | Amazon S3 | Not a mounted POSIX block device |
| Disk attached to an EC2 instance; boot volume; database pages | Block | Amazon EBS | A volume belongs to one Availability Zone |
| Temporary block storage physically attached to the host | Block | EC2 instance store | Data is ephemeral when the backing instance is lost, stopped, or terminated |
| Shared Linux namespace over NFS | File | Amazon EFS | Network file system; many clients can mount it |
| Native Windows file shares, SMB, Active Directory integration | File | FSx for Windows File Server | Choose it for Windows semantics, not merely because the client is EC2 |
| Parallel file access for HPC, ML, or media processing | File | FSx for Lustre | Optimized for high-throughput parallel workloads and can link to S3 |

The first pass can be almost mechanical:

```text
Need a filesystem or raw disk?
|
+-- No: access by object key / HTTP --------------------> S3
|
+-- Yes: one EC2 host needs a disk
|   |
|   +-- data must survive host replacement ------------> EBS
|   +-- scratch data; rebuildable; lowest local latency -> instance store
|
+-- Yes: several clients need the same files
    |
    +-- Linux / NFS / elastic capacity ----------------> EFS
    +-- Windows / SMB / Microsoft AD ------------------> FSx for Windows
    +-- HPC / parallel POSIX / S3 dataset -------------> FSx for Lustre
```

### "Shared" changes the answer

Suppose an Auto Scaling group serves user uploads. Placing the files on each instance's EBS volume creates separate islands of data. A request routed to another instance may not find the file. A shared EFS file system, or more commonly an object design using S3, removes that dependency on any one web server.

Likewise, do not select EFS merely because two EC2 instances exist. If each instance needs its own boot disk, EBS remains correct. **Shared namespace** is the clue, not the number of instances.

## Translate performance words into dimensions

Performance is not one number. The exam uses several dimensions that lead to different services.

| Dimension | Ask this | Typical signal |
| --- | --- | --- |
| Latency | How long may one operation take? | Database log, interactive workload, scratch space |
| IOPS | How many operations per second? | Many small, random reads and writes |
| Throughput | How many bytes per second? | Large sequential scans, ETL, log processing |
| Concurrency | How many workers need simultaneous access? | Web fleet, analytics cluster, HPC nodes |
| Durability | Must data outlive a disk, host, or AZ failure? | Source data, records, backups |
| Locality | Must storage be colocated with compute? | Ultra-low-latency cache or temporary processing |

The rough relationship is worth keeping in your head:

```text
throughput ~= IOPS x average I/O size
```

Ten thousand 4 KiB operations are IOPS-heavy but move only about 39 MiB/s. Five hundred 1 MiB operations move about 500 MiB/s. Both say "busy disk," but they demand different volume characteristics.

> **Trap:** Provisioning a volume for 20,000 IOPS does not guarantee the application receives 20,000 IOPS. The attached EC2 instance must also provide enough EBS bandwidth and IOPS, and the workload must issue enough parallel I/O.

## EBS: select the volume by the I/O, not the data label

EBS is persistent block storage for EC2. Volumes and snapshots solve different problems: the volume serves live I/O in one AZ; a snapshot is a durable, incremental backup stored by the service and can create volumes in other AZs.

### SSD-backed volumes: random and transactional I/O

| Volume | Choose it when | Exam contrast |
| --- | --- | --- |
| `gp3` General Purpose SSD | Most boot volumes, virtual desktops, development, and ordinary transactional workloads | Performance can be configured independently from capacity; start here unless the prompt proves otherwise |
| `gp2` General Purpose SSD | Existing/legacy designs where performance scales with volume size | Increasing size to gain IOPS is a `gp2` behavior; `gp3` decouples them |
| `io2` Provisioned IOPS SSD | Sustained high IOPS, consistent very low latency, or critical I/O-intensive databases | Pay to provision performance; designed for higher durability and demanding workloads |

Current `gp3` volumes include a baseline of **3,000 IOPS and 125 MiB/s**, with additional IOPS and throughput provisioned separately. That independence is the key architectural fact. Exact maximums can evolve and can also be limited by instance type, so exam questions normally give enough qualitative information: "general purpose" points to `gp3`; "sustained provisioned IOPS for a critical database" points to `io2`.

### HDD-backed volumes: sequential throughput

| Volume | Choose it when | Do not use it for |
| --- | --- | --- |
| `st1` Throughput Optimized HDD | Frequently accessed, large sequential data such as log processing, big data, and data warehouses | Boot volumes or small random database I/O |
| `sc1` Cold HDD | Infrequently accessed, throughput-oriented data at the lowest EBS storage cost | Latency-sensitive or frequently accessed workloads |

The giveaway is **large and sequential**. HDD-backed EBS is measured by its ability to stream data, not by excellence at small random operations. Neither `st1` nor `sc1` can be a boot volume.

### A disciplined EBS diagnosis

If an application on `gp3` is slow, reason through the whole path:

1. Inspect `VolumeReadOps`, `VolumeWriteOps`, queue length, and latency in CloudWatch.
2. Compare demand with the volume's configured IOPS and throughput.
3. Check the EC2 instance's aggregate EBS limits.
4. Check the application's I/O size and queue depth.
5. Only then provision more performance or change the volume type.

Changing `gp3` to `io2` cannot fix a single-threaded application that never drives the queue, and increasing volume throughput cannot overcome a smaller instance bandwidth ceiling.

## S3: object performance and access temperature

S3 is the default answer for durable, scalable object storage: static assets, data lakes, backups, media, and application objects. General purpose buckets provide regional resilience across multiple Availability Zones. S3 automatically scales, so do not invent an EBS-style capacity-provisioning step for it.

Choose a storage class from **access frequency, retrieval-time requirement, and resilience scope**:

| Class | Access pattern | Retrieval behavior / key caveat |
| --- | --- | --- |
| S3 Standard | Frequent or latency-sensitive access | Millisecond access; multi-AZ |
| S3 Intelligent-Tiering | Unknown or changing access | Automatically moves objects among access tiers; monitoring/automation charge applies |
| S3 Standard-IA | Infrequent but immediate access; multi-AZ required | Millisecond access, retrieval fee, minimum-duration considerations |
| S3 One Zone-IA | Infrequent, recreatable data | Millisecond access in one AZ; not resilient to AZ loss |
| S3 Glacier Instant Retrieval | Rare access but immediate retrieval | Millisecond access with archive economics and retrieval charges |
| S3 Glacier Flexible Retrieval | Archive; restore can wait minutes to hours | Restore before normal access |
| S3 Glacier Deep Archive | Long-lived archive; longest wait is acceptable | Lowest-cost archival tier; restore is asynchronous |

S3 Express One Zone is a special performance answer: it uses **directory buckets in one selected AZ** and is built for consistent single-digit-millisecond access to latency-sensitive object workloads. Colocate compute in the same AZ. Its single-AZ failure scope means it is not a drop-in resilience replacement for S3 Standard.

> **Trap:** Glacier Flexible Retrieval and Deep Archive are S3 storage classes, not a separate destination that applications read in real time. Archived objects require a restore workflow. Glacier Instant Retrieval is the class for rare data that still needs immediate reads.

## EFS and FSx: protocol is part of the requirement

### EFS for elastic NFS sharing

EFS is managed NFS file storage that can grow and shrink without preallocating a volume. A Regional file system stores data across Availability Zones and exposes mount targets so compute in multiple AZs can share a namespace. Common clues include Linux, NFS, shared web content, container persistence, home directories, and Lambda file access.

For most workloads, **General Purpose performance mode** and **Elastic throughput** are the default choices. Elastic throughput follows demand. Provisioned throughput is useful when a known workload needs throughput independent of stored capacity; Bursting throughput derives performance from file-system size and a credit model.

Do not confuse these two settings:

- **Performance mode** controls per-operation behavior. General Purpose favors lower latency. Max I/O is a previous-generation option for highly parallel workloads that accept higher per-operation latency.
- **Throughput mode** controls how throughput is supplied: Elastic, Provisioned, or Bursting.

An EFS One Zone file system trades multi-AZ resilience for a smaller failure boundary and should be mounted from resources in that same AZ. If the requirement says "survive an AZ failure without restoring," use Regional, not One Zone.

### FSx when the filesystem semantics are specialized

- Choose **FSx for Windows File Server** for native SMB shares, Windows ACLs, Microsoft Active Directory integration, and Windows application compatibility.
- Choose **FSx for Lustre** when many compute nodes need a fast parallel POSIX filesystem for HPC, ML training, video processing, or financial modeling. Its S3 integration lets an S3 dataset appear as files for processing and lets results flow back to S3.
- FSx also offers OpenZFS and NetApp ONTAP families. On the Associate exam, a question normally names the protocol, migration source, or feature that makes one of these specialized filesystems necessary.

"Managed file storage" alone is not enough. **NFS + broadly elastic shared Linux storage** generally points to EFS; **SMB + Windows** points to FSx for Windows; **parallel HPC** points to FSx for Lustre.

## Instance store: fast because it is local, temporary by design

Instance store is physically attached to the EC2 host. It is excellent for buffers, caches, scratch space, and replicated data where losing one node's copy is acceptable. It is not a durability mechanism.

Use this test:

```text
If the instance disappears, can the application reconstruct this data
from S3, a database, another replica, or the original input?

YES -> instance store may be a strong performance choice.
NO  -> choose durable storage and treat local copies only as caches.
```

A stop/start can place an EBS-backed instance on a different host, so instance-store data does not survive. A reboot generally keeps the same host, but designing around that distinction is fragile; classify instance store as ephemeral.

## Worked exam scenarios

### Scenario 1: transactional database

An EC2-hosted database performs sustained small random writes. The business requires consistent low latency and has measured IOPS above a general-purpose configuration.

**Choose:** `io2`, attached to an EBS-optimized instance with sufficient bandwidth. The small random I/O points to SSD; the sustained, measured performance requirement justifies Provisioned IOPS.

### Scenario 2: distributed log processing

Several EC2 workers scan multi-terabyte log segments sequentially. The data is frequently processed, and the software expects attached block devices.

**Choose:** `st1`. The workload values streaming throughput over small-operation IOPS. If the software could instead process objects directly, S3 may provide a more decoupled architecture—but the block-device constraint matters.

### Scenario 3: shared Linux web content

Instances scale across three AZs and must read and update the same directory tree using standard filesystem calls.

**Choose:** EFS Regional with mount targets in the relevant AZs. EBS does not create a fleet-wide namespace; instance store would split and lose the data.

### Scenario 4: rebuildable rendering scratch

A rendering fleet needs the lowest-latency temporary space for intermediate frames. Final outputs go to S3, and failed jobs are retried.

**Choose:** instance store where the selected EC2 family supports it. The data is local, temporary, and reproducible—the exact profile instance store is meant for.

### Scenario 5: HPC over an S3 dataset

Hundreds of Linux nodes repeatedly process a dataset already held in S3. The application requires POSIX file calls and parallel high throughput.

**Choose:** FSx for Lustre linked to S3. S3 remains the durable data repository; Lustre supplies the parallel filesystem interface for the compute stage.

## Exam traps to eliminate

| If the prompt says… | Reject this reflex | Reason |
| --- | --- | --- |
| "lowest latency" | Always choose instance store | Durability and sharing may rule it out |
| "shared by EC2" | EBS Multi-Attach | Multi-Attach is specialized block access, not a general shared filesystem |
| "archive" | Always choose Deep Archive | Required restore time may demand Instant or Flexible Retrieval |
| "database" | Always choose `io2` | Many databases fit `gp3`; provision only the performance justified |
| "Linux files" | Always choose EFS | HPC parallel access may point to FSx for Lustre |
| "high throughput" | Add IOPS | Throughput, instance bandwidth, I/O size, and access pattern all matter |

## Check your understanding

<details>
<summary><strong>1. A media company stores editing source files in S3, but 200 Linux nodes need parallel POSIX access during a four-hour rendering job. Which storage design fits best?</strong></summary>

Use FSx for Lustre linked to the S3 bucket. S3 remains the durable object repository, while Lustre gives the temporary processing fleet a high-performance parallel filesystem. EFS provides shared NFS but is not the strongest clue match for an explicitly HPC-style parallel workload.
</details>

<details>
<summary><strong>2. An EC2 database needs 3,000 IOPS today, and the team wants to increase disk capacity without automatically buying more performance. Which EBS family is the default?</strong></summary>

Use `gp3`. Its performance is configured independently from capacity, and its included baseline matches the stated need. Nothing in the scenario justifies Provisioned IOPS SSD.
</details>

<details>
<summary><strong>3. A compliance archive is read roughly once every seven years, and a twelve-hour restore process is acceptable. Which S3 class is the likely answer?</strong></summary>

S3 Glacier Deep Archive. The very rare access and generous restore window favor the lowest-cost long-term archive class. It would be wrong if millisecond access were required.
</details>

<details>
<summary><strong>4. Why can an EBS volume still underperform after its provisioned IOPS are increased?</strong></summary>

The EC2 instance may have a lower aggregate EBS IOPS or bandwidth ceiling; the workload may use large I/O and hit throughput first; or the application may not issue enough parallel requests. End-to-end performance is constrained by the smallest part of the path.
</details>

## Final recall

```text
OBJECT -> S3
ONE-HOST DURABLE BLOCK -> EBS
ONE-HOST REBUILDABLE SCRATCH -> instance store
SHARED NFS -> EFS
WINDOWS SMB -> FSx for Windows
HPC PARALLEL FILES -> FSx for Lustre

small + random       -> SSD / IOPS
large + sequential   -> throughput / HDD may fit
shared + multi-AZ    -> network service with the right protocol and resilience
```

When two answers both sound fast, return to the nouns and verbs in the requirement: **what is being accessed, through which interface, by how many clients, at what I/O size, and what must survive?** Those five questions usually leave only one defensible answer.

### AWS documentation

- [Amazon EBS volume types](https://docs.aws.amazon.com/ebs/latest/userguide/ebs-volume-types.html)
- [Amazon EFS performance](https://docs.aws.amazon.com/efs/latest/ug/performance.html)
- [Amazon S3 storage classes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html)
- [S3 Express One Zone high-performance workloads](https://docs.aws.amazon.com/AmazonS3/latest/userguide/directory-bucket-high-performance.html)
- [What is FSx for Lustre?](https://docs.aws.amazon.com/fsx/latest/LustreGuide/what-is.html)
- [What is FSx for Windows File Server?](https://docs.aws.amazon.com/fsx/latest/WindowsGuide/what-is.html)
