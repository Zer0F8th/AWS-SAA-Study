---
title: "A subnet is a routing decision."
description: "Read VPC scenarios as packet paths: route tables choose the target, while security groups and network ACLs decide what may pass."
order: 2
domain: performance
publishedAt: 2026-09-02
difficulty: Foundation
tags: ["vpc", "routing", "security-groups", "endpoints"]
objectives:
  - "Trace traffic through route tables, gateways, and security controls"
  - "Distinguish public and private subnet behavior"
  - "Choose security groups, network ACLs, NAT, and VPC endpoints from scenario clues"
featured: true
draft: false
---

A subnet is not public because someone named it `public-a`. It is public because its route table can send internet-bound traffic to an internet gateway—and a resource still needs a public address before the internet can route back to it.

That distinction captures the VPC questions on the exam: **follow the packet instead of trusting the label**.

> **Exam signal:** Separate connectivity from permission. A route creates a path. A security control permits or rejects traffic on that path. You often need both.

## Build the packet path

For every networking scenario, write the path as a short chain:

```text
source
  → source security group
  → subnet route table
  → route target
  → destination network
  → destination security controls
```

AWS automatically adds a `local` route for communication inside the VPC CIDR. More-specific routes win. If two matching routes have the same prefix length, AWS applies service-specific priority rules; exam questions usually avoid requiring you to resolve an ambiguous tie.

| Destination | Common target | Meaning |
| --- | --- | --- |
| VPC CIDR | `local` | Reach resources inside this VPC |
| `0.0.0.0/0` | Internet gateway | IPv4 internet path for publicly addressed resources |
| `0.0.0.0/0` | NAT gateway | Outbound IPv4 internet path for private resources |
| Prefix list | Gateway VPC endpoint | Private route to S3 or DynamoDB |
| On-premises CIDR | Virtual private gateway or transit gateway | Hybrid path over VPN or Direct Connect |
| Peered VPC CIDR | VPC peering connection | Private path to one peer VPC |

The route table belongs to the subnet association, not to an individual EC2 instance. Changing that association changes the path for every network interface in the subnet.

## Public does not mean exposed

A typical public subnet has `0.0.0.0/0 → igw`. An EC2 instance in it can communicate directly with the internet only when it also has a public IPv4 address or Elastic IP, and its security rules allow the flow.

A private subnet commonly has `0.0.0.0/0 → nat-gateway-id`. The NAT gateway lives in a public subnet and has an Elastic IP. Private instances initiate connections through it, but an internet client cannot initiate a connection through the NAT gateway to those instances.

```text
private EC2 → private route table → NAT gateway
            → public route table  → internet gateway → internet
```

For resilience, deploy a NAT gateway in each Availability Zone and route each private subnet to the NAT gateway in the same AZ. Sending every subnet through one NAT gateway adds a single-AZ dependency and cross-AZ data transfer.

IPv6 changes the nouns. Globally unique IPv6 addresses do not use NAT. An **egress-only internet gateway** permits outbound-initiated IPv6 communication while preventing unsolicited inbound connections.

## Security groups and network ACLs

Both filter traffic, but at different boundaries.

| Property | Security group | Network ACL |
| --- | --- | --- |
| Applied to | Elastic network interface | Subnet boundary |
| State | Stateful | Stateless |
| Rules | Allow only | Allow and deny |
| Evaluation | All rules together | Numbered order, lowest first |
| Return traffic | Automatically allowed for an allowed flow | Must be explicitly allowed |
| Useful source | CIDR or another security group | CIDR |

“Stateful” is the decisive word. If an instance accepts an inbound HTTPS request through its security group, response traffic is automatically allowed even without a matching outbound rule. A stateless network ACL needs rules for both directions, including the appropriate ephemeral port range for return traffic.

Use security groups as the primary workload firewall. Use network ACLs when the requirement calls for subnet-wide guardrails or an explicit deny by IP range.

> **Exam trap:** Opening a network ACL does not repair a missing route, and adding an internet route does not override a restrictive security group. Diagnose the layer named in the symptoms.

## Private access to AWS services

A NAT gateway can reach public AWS service endpoints, but it adds processing cost and keeps the path dependent on public addressing. A VPC endpoint keeps supported service traffic on the AWS network.

- A **gateway endpoint** is a route-table target for Amazon S3 and DynamoDB. It has no hourly charge and can be restricted with an endpoint policy.
- An **interface endpoint** places private IP addresses in your subnets using AWS PrivateLink. Security groups control access to its network interfaces. It supports many AWS and partner services.
- A **Gateway Load Balancer endpoint** steers traffic through virtual network appliances.

If a private EC2 fleet uploads to S3 and the question asks for the lowest-cost private path without a NAT gateway, the S3 gateway endpoint is the strong answer.

## Connect networks without creating a maze

VPC peering is private and direct, but it is not transitive. If VPC A peers with B and B peers with C, A cannot reach C through B. Each required pair needs its own peering connection and routes.

AWS Transit Gateway is the hub-and-spoke answer when many VPCs and on-premises networks must communicate. It centralizes attachments and routing instead of creating a web of peerings.

For hybrid connectivity:

- Site-to-Site VPN is encrypted over the public internet and can be established quickly.
- Direct Connect provides a dedicated private connection with more consistent network behavior, but provisioning takes longer.
- A common resilient design uses Direct Connect as the primary path and VPN as backup.

## Walk through a scenario

A company runs application servers in private subnets across three AZs. The servers need operating-system updates, frequent S3 access, and no unsolicited inbound internet traffic. The architecture must avoid one-AZ dependencies and reduce data-processing cost.

Work requirement by requirement:

1. Put a NAT gateway in each AZ for general outbound IPv4 access.
2. Route each private subnet to its same-AZ NAT gateway.
3. Add an S3 gateway endpoint to the private route tables so S3 traffic bypasses NAT.
4. Keep inbound access behind a load balancer or use Systems Manager instead of assigning public addresses.
5. Use security-group references between tiers instead of broad CIDR rules where possible.

One NAT gateway could provide connectivity, but it fails the AZ-resilience clue. Three NAT gateways without the S3 endpoint work, but miss the cost clue.

## Check your understanding

<details>
<summary>A private instance can reach another subnet in its VPC but cannot download updates from the internet. Its security group allows all outbound traffic. What should you inspect next?</summary>

Inspect the subnet route table for a default route to a NAT gateway, then verify that the NAT gateway is available in a public subnet whose own route table points to an internet gateway. The successful local traffic shows that VPC-local routing works; an outbound security-group rule alone cannot create an internet path.

</details>

## Takeaways

- A route chooses where traffic goes; a security control chooses whether it may pass.
- Public subnet = route to an internet gateway. Public workload = that route plus a public address and permissive security rules.
- NAT gateway is outbound IPv4 for private subnets; egress-only internet gateway is the analogous outbound-only IPv6 component.
- Security groups are stateful and workload-level. Network ACLs are stateless, ordered, and subnet-level.
- Use gateway endpoints for private S3 and DynamoDB access; use interface endpoints for PrivateLink-supported services.
- Peering is not transitive. Transit Gateway is the many-network hub.

## Sources

- [VPC route tables](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Route_Tables.html)
- [Compare security groups and network ACLs](https://docs.aws.amazon.com/vpc/latest/userguide/infrastructure-security.html#VPC_Security_Comparison)
- [VPC endpoint concepts](https://docs.aws.amazon.com/vpc/latest/privatelink/concepts.html)
- [NAT gateways](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html)

