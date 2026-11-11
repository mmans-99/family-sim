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

## Payment dates (used by the calendar, `data/calendar.json`)
- Mortgage: paid on the 1st of the month at 06:00 (tuning, not checked against the lender). The first in-game payment is 1 April 2026; the 1 March 2026 payment falls before the game opens at 07:00 and is already in the opening balance (DECISIONS, 11 Nov 2026).
- Pay: Tom's take-home pay on the 28th at 09:00 (tuning).
- Council tax: 10 monthly instalments, April to January, on the 1st at 07:00 (tuning; confirm with Birmingham City Council).
- Energy bill on the 10th at 07:00; water on the 15th at 07:00; broadband and phones on the 20th at 07:00 (all tuning).
- Savings interest on the last day of each month at 23:00 (tuning).
- Energy price cap: changes on 1 January, 1 April, 1 July and 1 October (Ofgem's quarterly cap). The energy bill stays flat in L2; prices change from L11.
- School term dates: not yet set.

## Income (checked 11 Nov 2026)
| Item | Value | Source and notes |
|---|---|---|
| Tom's gross salary | **£75,000 a year** | User's choice (11 Nov 2026). |
| Workplace pension | **5%** of salary (£3,750 a year), taken before income tax (net-pay method) | User's choice. Simplification: taken from the whole salary, not the auto-enrolment qualifying-earnings band. |
| Income tax 2026/27 (England) | Personal allowance **£12,570**; 20% up to £50,270; 40% up to £125,140; 45% above. The allowance falls by £1 for every £2 over £100,000. | [gov.uk income tax rates](https://www.gov.uk/income-tax-rates); cross-checked on litrg.org.uk and moneytothemasses.com. |
| Employee National Insurance (Class 1) 2026/27 | **8%** between £12,570 and £50,270; **2%** above | [gov.uk rates and thresholds for employers 2026 to 2027](https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027); cross-checked on litrg.org.uk. |
| Take-home pay | **£51,807.40 a year, £4,317.28 a month** | Worked out in `src/sim/household.js` from the rules above: £75,000 − £3,750 pension − £15,932 income tax − £3,510.60 NI. Checked by hand (tests), not yet against a published worked example. |
| Student loan | None | User's choice. |
| Child Benefit | Not claimed | User's choice; the High Income Child Benefit Charge would take most of it back at £75k. |

## Household bills (checked 11 Nov 2026)
| Bill | Starting value | Source and notes |
|---|---|---|
| Energy (gas + electricity) | **£1,723 a year** (about £143.58 a month) | Ofgem price cap, 1 Oct to 31 Dec 2026, typical dual-fuel Direct Debit household ([Energy Saving Trust](https://energysavingtrust.org.uk/what-is-the-energy-price-cap/)). The cap is reviewed every three months. Forecasts predicted a further rise from January 2027 ([Money to the Masses](https://moneytothemasses.com/news/energy-bills-to-rise-by-4-from-october-with-14-rise-predicted-for-january)), so the sim should model the cap changing (L11). |
| Council tax (Birmingham, **Band C**) | **£2,100.36 a year**: 10 instalments of £210.04, April to January | 2026/27 Band C ([uktax.tools](https://uktax.tools/council-tax-birmingham), also paychecktaxcalculator.net and salarytax.uk), which agree and equal 8/9 of the Band D figure below. **Conflict:** the Birmingham budget booklet gives Band D (City, Fire and PCC) as £2,353.17 excluding parish precepts, which would make Band C about £6 a year lower. The instalment months are tuning. |
| Council tax, Band D (for reference) | £2,363 a year | 2026/27 Band D including all precepts ([MHCLG figure via paychecktaxcalculator](https://paychecktaxcalculator.net/council-tax-by-borough/birmingham)). |
| Water and sewerage (Severn Trent) | **£587 a year** (about £48.92 a month) | 2026/27 average, up 10% from April 2026 ([Severn Trent](https://www.stwater.co.uk/my-account/why-is-my-bill-going-up/)). |
| Broadband | **£35.90 a month** (tuning) | Uswitch 2026 average, via [phonearena.com](https://www.phonearena.com). **Conflict:** Broadband Genie gives £22.86 and broadbandswitch.uk, citing Ofcom, about £26. The higher figure is used on purpose. |
| Mobile phones (two adults) | **£37.20 a month**: £18.60 each (tuning) | Uswitch 2026 average per user, via phonearena.com. |
| Food and non-alcoholic drink at home | **£134.52 a week** for four (tuning) | gov.uk Family Food survey, FYE 2025 (statistics release): £33.63 a person a week at home, × 4. An average for all ages, so a tuning figure. Eating out is left out. |
| Everyday spending (recreation and culture) | **£82.10 a week** (tuning) | ONS Family Spending, FYE 2025, per household (ONS table as shown in a UK Data Service slide deck; the release itself was not opened). **Understatement:** the absolute weekly figures for household goods, personal goods and clothing were not found, so they are left out. |
| Savings interest | **2.53% a year**, paid monthly (tuning) | Moneyfacts average easy-access rate, September 2026 (Treasury report). |

## Choices made for L2 (2026-11-11, user approved; details in `docs/LIFE_SYSTEMS.md` 3a)
- Council tax: **Band C**.
- **No car.** Tom works from home.
- **Child Benefit not claimed.** Tuning.
- Tom: **£75,000** gross, **5% workplace pension** (net-pay), **no student loan**.
- Starting money (tuning): **£2,500** joint current account, **£8,000** savings, overdraft limit **£1,500**.
- Mortgage first payment assumed 1 May 2024 (tuning). Before the game opens on 1 March 2026, 23 repayments have been made (May 2024 to March 2026), so the opening balance is about £228,302. The balance is worked out by the code, not typed in.

## Sourcing gaps for L2 (Step 0, done 11 Nov 2026)
- No published worked example for take-home pay was found; the tests check a hand sum instead.
- The absolute weekly figures for household goods, personal goods and clothing (ONS) were not found.
- Broadband and the Band C figure have source conflicts (above). The higher or chosen figure is used and labelled tuning.
- The mortgage rate, the first payment date and the starting balances are assumptions, not offers.
