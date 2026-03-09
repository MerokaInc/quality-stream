We are Meroka, a venture-funded startup that aims to save independent practices and restore humanity in patient care in the United States.

The way we aim to do that is by making a highly efficient market more efficient through data

Here’s one way to frame the product objective:
Meroka is trying to prove it can create a pricing/market mechanism where an employer pays less for better care, while a practice earns more.
That means the company has to understand both sides of the equation:
the employer side
the practice side
And it has to connect:
cost,
quality,
reimbursement,
ownership/independence,
benefits design,
demographics,
and other supporting data
The purpose of this project is to help find and follow “treasure maps” of high-signal data along these dimensions.
To do so, we have data scientists and data engineers. We are acting as the data scientists here who prove the flow of our pipeline end-to-end in our local environment, from dataset to ready-to-use metrics or indicators on employers and independent practices
The aim is to send a Github repo proving this flow to data engineers who will then proceed to load them in a data lake and warehouse such that a final relational, analytical database is made available to query for all and any downstream “client” apps through an API endpoint. This endpoint will help perform queries on the final DB and a Slack agent (#m-alpha-agent) will be built on top of it to interface with it in natural language

__________


On the datasets:
- @MUP_PHY_R25_P05_V20_D23_Prov_Svc.csv is for Medicare 2023
- @medicaid-provider-spending.parquet is for Medicaid 2018-2024

__________


On the NPI for the PoC:

"""

Here's what I found for Brandon M. Lingenfelter, DO, PhD:
Individual NPI: 1790045821 NPIDB — This is his individual provider NPI, listed under the specialty Obstetrics & Gynecology (taxonomy code 207V00000X) in Princeton, WV NPIDB.
Organization NPI: 1619842465 HIPAASpace — This is assigned to his practice entity, Brandon M Lingenfelter DO PhD PLLC, located at 411 12th Street Ext, Princeton, WV 24740

"""

_________

Some more information:

Plan is to get a proof of concept for computing a clinical quality score for one practice (Dr. Linkenfelter, OB-GYN in West Virginia) for one quality dimension (clinical quality)

Right problem for the prompt: “Do a join with NPIs to get all CPT codes per NPI on public claims datasets from medicaid and medicare”