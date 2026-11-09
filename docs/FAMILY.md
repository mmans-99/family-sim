# The starting family

Setting: Birmingham, West Midlands. The family lives in a 3-bed semi-detached house with a back garden. They bought the house within the last couple of years, so they have a mortgage.

| Role | Name | Age | Work / school | Notes |
|---|---|---|---|---|
| Dad | Tom | 36 | Software engineer, works from home, £70–80k | Main earner. Office hours at home. |
| Mum | Sarah | 34 | Stay-at-home mum | Runs the home, childcare, bills. |
| Child | Oliver | 7 | Primary school (Year 2/3) | School run, homework, friends. |
| Toddler | Ruby | 2 | Home (nursery later) | Needs constant care. Can't cook or be left alone. |

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

## Household bills (to set)
Rough categories to include: energy, water, broadband, council tax (Birmingham band), phone, car or transport, food, and general spending. Exact figures aren't set yet. Check current Ofgem price cap and Birmingham council tax figures before setting them in `data/`.

## Open questions
- Confirm the bill levels when we set them in `data/`.
- Is there a car? (affects bills and commuting)
