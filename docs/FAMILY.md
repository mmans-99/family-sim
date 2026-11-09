# The starting family

Setting: Birmingham, West Midlands. The family lives in a 3-bed semi-detached house with a back garden. They bought the house within the last couple of years, so they have a mortgage.

| Role | Name | Age | Work / school | Notes |
|---|---|---|---|---|
| Dad | Tom | 36 | Software engineer, works from home, £70–80k | Main earner. Office hours at home. |
| Mum | Sarah | 34 | Stay-at-home mum | Runs the home, childcare, bills. |
| Child | Oliver | 5 | Primary school (Reception or Year 1, depends on birthday) | School run, homework, friends. |
| Toddler | Ruby | 1 | Home | Needs constant care. Can't walk far, cook or be left alone. |

Personalities: fully random, rolled from the seed at the start.

## Home and mortgage (starting values)
Assumed bought in spring 2024 for **£265,000**, a typical Birmingham semi.
- Deposit 10%: £26,500. Loan: £238,500.
- 25-year term. 5-year fixed at about 4.6%, set in 2024 (an assumption, not a quote).
- Monthly repayment: about **£1,340**.
- The fix ends in spring 2029. Then the mortgage is remortgaged at a rate that reflects the market at that time, so the sim needs to model that change.

## Market context (checked 9 Nov 2026)
- Birmingham semi-detached prices: an average of about £270,000 over July 2025 to June 2026 ([plumplot](https://www.plumplot.co.uk/City-Birmingham-house-prices.html)). Other data sources show about £282,000 ([Rightmove](https://www.rightmove.co.uk/house-prices/Birmingham.html)). Our £265,000 purchase is in that range.
- Bank of England base rate: raised from 3.75% to **4%** on 5 November 2026, its first rise since 2023 ([Trustnet](https://www.trustnet.com/news/13487959/bank-of-england-raises-interest-rates-to-4-with-hints-of-more-to-come/)). Markets expect rates to keep moving, so the sim should include rate changes.

## Household bills (checked 9 Nov 2026)
| Bill | Starting value | Source and notes |
|---|---|---|
| Energy (gas + electricity) | **£1,723 a year** (about £144 a month) | Ofgem price cap, 1 Oct to 31 Dec 2026, typical dual-fuel Direct Debit household ([Energy Saving Trust](https://energysavingtrust.org.uk/what-is-the-energy-price-cap/)). The cap is reviewed every three months. Forecasts predicted a further rise from January 2027 ([Money to the Masses](https://moneytothemasses.com/news/energy-bills-to-rise-by-4-from-october-with-14-rise-predicted-for-january)), so the sim should model the cap changing. |
| Council tax (Birmingham) | **£2,363 a year** for Band D (about £197 a month) | 2026/27 Band D including all precepts ([MHCLG figure via paychecktaxcalculator](https://paychecktaxcalculator.net/council-tax-by-borough/birmingham)). Band C is about £2,100. The family's band is still to choose. Single-occupier discount doesn't apply (two adults). |
| Water and sewerage (Severn Trent) | **£587 a year** (about £49 a month) | 2026/27 average, up 10% from April 2026 ([Severn Trent](https://www.stwater.co.uk/my-account/why-is-my-bill-going-up/)). |

Not yet checked: broadband, mobile phones, car or transport, food, and general spending. Those need sourcing before they go in `data/`.

## Open questions
- Which council tax band does the house sit in? (Band C is likely for a 3-bed semi, but this needs checking.)
- Is there a car? (affects bills and commuting)
