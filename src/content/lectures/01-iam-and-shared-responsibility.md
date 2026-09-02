---
title: "IAM: Know Who Owns What"
description: "Separate AWS duties from customer duties, then design access with roles, policies, and least privilege."
order: 1
domain: secure
publishedAt: 2026-09-02
updatedAt: 2026-09-02
difficulty: Foundation
tags:
  - IAM
  - shared responsibility
  - least privilege
  - Organizations
objectives:
  - Distinguish security of the cloud from security in the cloud
  - Choose among IAM users, groups, roles, and resource policies
  - Apply least privilege and reason about explicit denies
  - Recognize how service control policies constrain accounts
featured: true
draft: false
---

Security questions on the SAA-C03 exam usually hide two decisions inside one scenario: **who is responsible**, and **who is allowed**. The shared responsibility model answers the first. AWS Identity and Access Management (IAM) answers the second.

Get those boundaries right and many long scenarios become short elimination exercises.

## The shared responsibility model

AWS is responsible for **security of the cloud**: the facilities, physical hardware, networking, and virtualization layer that operate AWS services. The customer is responsible for **security in the cloud**: data, identities, permissions, and the configuration of chosen services.

The exact dividing line moves with the service.

| Workload choice | AWS operates | You still own |
| --- | --- | --- |
| Amazon EC2 | Facilities, hardware, network infrastructure, hypervisor | Guest OS patches, applications, security groups, IAM, and data |
| Amazon RDS | Infrastructure plus the managed database platform | Database users, network access, encryption choices, backups/retention configuration, and data |
| AWS Lambda | Servers, operating system, and runtime infrastructure | Function code, dependencies, execution role, resource configuration, and data |
| Amazon S3 | Storage infrastructure and service availability | Bucket policies, public-access settings, object permissions, encryption configuration, and data classification |

The pattern is simple: **the more managed the service, the less infrastructure you administer—but you never outsource access decisions or ownership of your data.**

> **Exam trap:** “AWS manages it” does not mean “AWS secures my configuration.” AWS can operate S3 while a customer-written bucket policy still exposes data.

## IAM evaluates a request

Think of every API call as four facts:

```text
principal  +  action  +  resource  +  context
Alice         s3:GetObject  arn:aws:s3:::exam-notes/*  from approved network
```

The **principal** is the identity making the request. The **action** is the API operation. The **resource** is what the action targets. **Context** can include conditions such as source IP, tags, MFA, time, or organization ID.

IAM begins with an implicit deny. A relevant `Allow` can grant access, but a relevant explicit `Deny` wins. At exam level, use this order:

1. Look for an explicit deny in an identity policy, resource policy, permissions boundary, session policy, or organization guardrail.
2. Confirm that an applicable policy allows the requested action on the requested resource.
3. Confirm that boundaries and organization policies do not limit that permission.
4. If no allow applies, the request remains implicitly denied.

Here is a deliberately narrow identity-policy statement:

```json
{
  "Effect": "Allow",
  "Action": "s3:GetObject",
  "Resource": "arn:aws:s3:::saa-study/lectures/*"
}
```

It permits reads under one prefix. It does not permit listing every bucket, uploading objects, changing the bucket policy, or reading a different prefix. That is least privilege in practice.

## Choose the right identity

| IAM tool | Best fit | Exam signal |
| --- | --- | --- |
| IAM user | A workload or person that truly requires long-term credentials | Treat as the exception; rotate and protect credentials |
| IAM group | Attach common permissions to several IAM users | Users belong to groups; roles do not |
| IAM role | Temporary access for AWS services, federated users, or another account | Prefer temporary credentials and role assumption |
| Resource policy | Grant principals access directly on a resource | Common with S3, SQS, KMS, and cross-account access |
| IAM Identity Center | Central workforce access to multiple AWS accounts and applications | Human access across an organization |

Applications running on EC2, Lambda, or ECS should normally receive credentials through an **IAM role**. Do not place access keys in source code, an AMI, or environment files. AWS Security Token Service (STS) supplies temporary credentials when the role is assumed.

For cross-account access, the destination account creates a role with two relevant pieces:

- A **trust policy** names who may assume the role.
- A **permissions policy** defines what the assumed role may do.

Both relationships matter. Trust without useful permissions achieves nothing; permissions on a role that the caller cannot assume also achieve nothing.

## Guardrails are not grants

AWS Organizations service control policies (SCPs) set the maximum available permissions for member accounts. They do **not** grant permissions by themselves.

If an SCP permits `ec2:*`, a developer still needs an IAM policy that grants the required EC2 actions. If an SCP explicitly denies leaving approved Regions, an administrator policy inside a member account cannot override it.

Permissions boundaries play a similar limiting role for an IAM user or role. A boundary defines the maximum permissions that identity-based policies can provide; it is not an additional permission grant.

## Root is for root-only tasks

The account root user has unrestricted account access. Protect it with MFA, avoid creating root access keys, and do not use it for daily administration. Use named or federated identities and roles instead so actions are attributable and permissions can be limited.

<details>
<summary><strong>Check your understanding:</strong> A developer has an IAM policy allowing <code>s3:PutObject</code>, but an organization SCP denies that action. Can the developer upload?</summary>

No. The SCP is a guardrail, and its explicit deny overrides the identity-policy allow. Changing the IAM policy to `AdministratorAccess` would not bypass the SCP.

</details>

## Takeaways

- AWS secures the underlying cloud; customers secure identities, data, and service configuration.
- Prefer roles and temporary credentials over long-lived access keys.
- Start with implicit deny, grant only what is required, and remember that explicit deny wins.
- Trust policies answer **who may assume a role**; permissions policies answer **what the role may do**.
- SCPs and permissions boundaries limit permissions. They do not grant them.
- Protect the root user and reserve it for tasks that require root credentials.

## Sources

- [AWS shared responsibility model](https://aws.amazon.com/compliance/shared-responsibility-model/)
- [Security best practices in IAM](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [Policies and permissions in IAM](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies.html)
- [Service control policies](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps.html)
- [AWS account root user best practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/root-user-best-practices.html)
