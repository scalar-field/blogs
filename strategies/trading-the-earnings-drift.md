---
title: "Trading the Earnings Drift"
description: "Can a stock keep outperforming for weeks after a strong earnings report? We turned one of the best-known market anomalies into a live paper-trading agent."
date: "2026-08-15"
mode: "center"
---

**Can a stock keep outperforming for weeks after a strong earnings report? We turned one of the best-known market anomalies into a live Scalar Field paper-trading agent to find out.**

When a company reports earnings, markets react almost instantly.

A big beat can send a stock up 10% overnight. A disappointing outlook can erase months of gains before the next market open.

In a perfectly efficient market, that should largely be the end of the story. New information arrives, investors process it, and the stock reprices.

But decades of academic research suggest that something else can happen:

> Stocks sometimes continue moving in the direction of an earnings surprise for weeks or even months after the announcement.

This phenomenon is known as **Post-Earnings Announcement Drift, or PEAD**. Quantpedia describes PEAD as a well-documented anomaly in which abnormal returns can persist for several weeks or months after positive earnings news.

We wanted to see whether that effect is still economically interesting in today's market.

So we took the [Post-Earnings Announcement Effect strategy from Quantpedia](https://quantpedia.com/strategies/post-earnings-announcement-effect), investigated the original methodology, audited the data required to reproduce it, built a live-tradable variation, backtested it over the last decade, and then deployed it through an Alpaca Paper agent on Scalar Field.

**Follow the live experiment:** [Combined SPY-IWM Analyst PEAD](https://scalarfield.io/share-strategy/combined-spy-iwm-analyst-pead/JCQRLZxwwaIrLryBimiHYPo_T0U3wD9r1baTH8rrrEQ)

---

## What is PEAD?

Suppose a company reports substantially better earnings than expected.

Its stock jumps 7%.

If investors immediately incorporated everything contained in the report, there should be no systematic reason for the stock to continue outperforming afterward.

PEAD says that historically, this has not always been the case.

One common explanation is **underreaction**: investors initially adjust prices in the correct direction but do not immediately incorporate the full implications of the new information. Quantpedia notes underreaction as one of the main explanations proposed for PEAD.

But simply buying every company that beats EPS estimates would be a very crude interpretation of the research.

An earnings release contains far more information than one number.

A company can beat EPS while simultaneously reporting:

- weak revenue;
- deteriorating margins;
- lower guidance;
- unexpected capital expenditures;
- changes in demand;
- management commentary that changes the outlook.

The strategy we wanted to test therefore asks two separate questions:

> **Were the earnings unusually good?**

and

> **Did the market itself react as though something important happened?**

---

## Two signals: SUE and EAR

The Quantpedia strategy combines two measures: **SUE** and **EAR**. The original methodology takes the intersection of stocks ranking highly on both rather than relying on only one signal.

### SUE: How surprising were the earnings?

SUE stands for **Standardized Unexpected Earnings**.

For the production agent, we begin with:

> Reported EPS − pre-announcement consensus EPS

But a 10-cent beat does not mean the same thing for every company.

So the strategy compares today's forecast error with the company's previous **eight earnings forecast errors**.

A company that routinely beats estimates by 10 cents should not receive the same signal as a company for which a 10-cent beat is extremely unusual.

The result asks:

> How abnormal was this earnings surprise relative to this company's recent history?

### EAR: How surprising was the market reaction?

EAR stands for **Earnings Announcement Return**.

Instead of looking only at accounting earnings, EAR measures the stock's abnormal return around the earnings announcement.

This is important because the price reaction can incorporate information that EPS alone misses: revenue, margins, investment, guidance and other information released alongside earnings. The source research explicitly describes EAR as capturing this broader information set.

So our strategy does **not** say:

> EPS beat → buy.

It says:

> **Extreme positive earnings surprise + extreme positive market reaction → candidate.**

---

## Both signals have to agree

This is the central rule.

Every quarter, Scalar Field calculates the previous quarter's distribution of SUE and EAR.

A new earnings event qualifies only if it independently exceeds:

> **the 80th percentile for SUE**

**and**

> **the 80th percentile for EAR.**

A huge EPS beat with an unconvincing stock reaction does not qualify.

A stock that rockets after mediocre reported earnings does not qualify either.

Both signals need to be unusually strong.

This follows the core structure documented by Quantpedia: stocks are independently sorted on SUE and EAR, and the long portfolio is formed from the intersection of the highest quintiles.

---

## We first tried to reproduce the paper exactly

This is where the project became more interesting.

The source-paper methodology does **not** primarily define SUE using analyst consensus EPS.

Its primary definition uses quarterly **Income Before Extraordinary Items** from Compustat and estimates expected earnings with a seasonal earnings model.

EAR is also not simply the stock's return relative to SPY. The academic version compares the stock against a portfolio of companies with similar size and book-to-market characteristics.

Our first instinct was to reproduce that as faithfully as possible.

Before trusting the backtest, however, we audited the historical data.

And that stopped the replication.

---

## The point-in-time data problem

The exact Compustat earnings field required by the paper was not available in Scalar Field's fundamental dataset.

There were nearby fields—such as FactSet net income—but they were not definitionally identical. More importantly, the historical observations were associated with **fiscal-period dates**, not auditable first-publication timestamps.

That creates a classic backtesting problem.

Imagine a company's quarter ends on June 30.

Today, a historical database knows exactly what the company earned in that quarter and may associate the observation with June 30.

But investors on June 30 did not know the number yet. It might not have been reported until several weeks later.

If a backtest accidentally uses that value before it became public, it gains information that a real investor never had.

That is look-ahead bias.

Our audit found that the fundamental dates behaved like fiscal-period dates rather than publication timestamps, so we could not prove the exact earnings information would have been known at the proposed trade time.

Rather than silently use a substitute and call the result a faithful replication, we stopped.

---

## Building the live-tradable version

The earnings-event dataset gives us something much more useful operationally:

- reported EPS;
- the associated pre-announcement consensus estimate;
- earnings date;
- earnings release time; and
- fiscal-period information.

The original research also discusses analyst forecasts as an alternative earnings-surprise specification, making analyst-consensus SUE a reasonable production variation rather than an unrelated strategy.

So we built the agent around that.

We call it:

> **Combined SPY-IWM Analyst PEAD**

It is not an exact reproduction of the original academic strategy.

It is a production adaptation designed around data that can actually be observed around an earnings event.

---

## The production rules

The live agent operates across contemporaneous **SPY and IWM constituents**, giving the strategy exposure to both large and smaller US companies. Smaller companies are particularly relevant because PEAD research has often found a stronger effect among small-cap stocks.

The final rules are:

| Rule | Production implementation |
|---|---|
| Universe | SPY + IWM constituents |
| Direction | Long only |
| Earnings signal | Analyst-consensus SUE |
| SUE history | Exactly 8 prior forecast errors |
| Price signal | Session-aware EAR |
| Eligibility | Top 20% SUE **and** top 20% EAR |
| Entry | t+2 open |
| Maximum holding period | 60 trading sessions |
| Maximum positions | 20 |
| Sizing | Equal-sized at entry |
| Cash reserve | 5% |
| Routine weight rebalancing | None |
| Historical cost assumption | 10 bps per side |
| Peak drawdown control | Pause new entries at -15% |
| Emergency loss control | 25% of initial strategy capital |

The academic implementation uses a much broader stock universe, an uncapped portfolio, and different benchmark construction, so these are meaningful production deviations rather than cosmetic changes.

---

## Earnings timing matters

There is another important difference between historical research and a live agent.

We know **when** an earnings release occurred.

Suppose a company reports at 4:15 p.m. ET on Monday.

Monday's regular-session stock movement cannot have been caused by information that was not released until after the market closed.

So the agent is session-aware.

For a pre-market or during-market report, that trading session becomes the effective earnings session.

For an after-market report, the **next trading session** becomes the effective session.

Weekend and holiday reports similarly map to the next trading day.

The strategy then waits for the complete reaction window to become observable before entering at the **t+2 open**.

That distinction is fundamental to what we're testing.

This is not an earnings-news latency strategy.

We are deliberately allowing the market to react first.

The question is whether the reaction continues afterward.

---

## Why hold for 60 trading days?

The original Quantpedia implementation enters on the second trading day following the earnings announcement and holds for approximately **60 trading days**.

That is the anomaly.

We're not trying to predict the first 30 seconds after earnings.

We're testing whether new information continues being incorporated into prices over the following weeks.

If the company reports another earnings result before the holding period ends, however, the information set changes.

The new report becomes a new event.

The agent recalculates SUE and EAR.

If the stock qualifies again, its 60-day clock restarts.

If it fails to qualify—or there is insufficient information to requalify—it exits.

---

## We also stopped replacing winners

The first production-style backtest allowed a newly qualifying stock with a stronger SUE/EAR score to displace an existing holding whenever all 20 portfolio slots were occupied.

That generated substantial turnover.

More importantly, it introduced a second strategy on top of PEAD:

> Instead of simply holding an earnings-drift signal, the portfolio was constantly rotating toward whichever current signal ranked highest.

So we changed the rule.

In the final agent:

> **An existing active holding is not removed merely because a stronger new PEAD candidate appears.**

A position remains until its 60-session period ends or a new earnings announcement causes it to fail requalification.

If all 20 positions are occupied, new qualifying events are still recorded, but they do not automatically displace an existing holding.

This also gives us an interesting future comparison: the live agent records **uncapped shadow signals**, allowing us to study what happened to qualifying stocks that could not enter the 20-position production portfolio.

---

## Does the production strategy work historically?

After fixing the final production rules, Scalar Field re-ran the Combined portfolio using:

- exactly eight prior earnings forecast errors;
- no rank-based replacement of existing positions; and
- the final production portfolio logic.

Over the full historical sample, the result was:

| Metric | Combined PEAD |
|---|---:|
| **CAGR** | **13.20%** |
| **Sharpe ratio** | **0.711** |
| **Maximum drawdown** | **-31.61%** |

The most recent five-year period produced a **10.12% CAGR**.

These are the numbers that matter for the live version.

They supersede the earlier backtest that allowed rank replacement.

And the drawdown remains important.

A -31.61% historical maximum drawdown is not the profile of a riskless anomaly.

That is one reason we are running this in paper trading rather than treating the historical result as proof of a durable edge.

---

## Historical performance still has an important caveat

Even the analyst-based backtest is **not fully point-in-time audited**.

The historical earnings dataset identifies the consensus estimate associated with each report, but it does not contain a complete archive of daily analyst-estimate snapshots, individual analyst forecasts, revision histories, or an independently auditable estimate timestamp.

So the historical analysis should be interpreted as:

> **Evidence worth testing prospectively.**

Not:

> **A perfect recreation of what could definitely have been traded at every point in history.**

That distinction is one of the main reasons for running the live experiment.

From this point forward, there is no historical-vintage ambiguity.

The agent only sees the information available to it as events occur.

---

## Risk controls

The historical drawdown made one thing clear: the agent needs explicit risk controls.

There are two layers.

### 15% peak-NAV entry pause

If strategy NAV falls 15% from its previous peak:

> **Stop opening new positions.**

Existing positions continue to be managed according to their normal rules.

The idea is not that every existing PEAD signal suddenly becomes invalid.

The drawdown is instead a warning:

> Something may have changed. Stop adding risk and review the strategy.

### 25% initial-capital hard stop

The agent also has a separate emergency hard stop at a 25% loss relative to its initial $25,000 economic strategy capital.

That is intentionally wider than the entry-pause threshold.

The first control pauses risk-taking.

The second is an emergency boundary.

---

## Turning a backtest into a real agent

Deploying the strategy surfaced problems that a notebook backtest never has to think about.

For example, the agent needed to handle:

- earnings released after the final run of the day;
- weekend and holiday announcements;
- revised or delayed earnings records;
- duplicate event discovery;
- holdings that receive a new earnings report but lack enough data to requalify;
- pending mandatory sell orders; and
- preventing new purchases from relying on proceeds that have not yet been reconciled.

The production agent now searches a rolling seven-calendar-day event window with event-key deduplication so after-close and weekend reports are not lost between scheduled runs. It also defers new purchases if mandatory sell orders are still unresolved.

These details are not particularly glamorous.

But they are often the difference between a backtest and an actual trading system.

---

## The live experiment

The **Combined SPY-IWM Analyst PEAD** agent is now active on Scalar Field using Alpaca Paper.

It has an isolated strategy ledger of:

> **$25,000**

even though the connected paper brokerage account contains unrelated positions. The PEAD agent does not claim or manage those other holdings.

At initialization:

- NAV/cash was $25,000;
- there were no PEAD positions;
- there were no PEAD orders;
- current peak drawdown was 0%; and
- 78 historical Q3 qualifying events had been recorded as shadow signals rather than converted into stale trades.

The agent's next scheduled market-hours invocation is:

> **Monday, August 17, 2026 at 9:30 a.m. ET.**

From there, the live record can begin accumulating prospectively.

**Follow the agent:** [Combined SPY-IWM Analyst PEAD](https://scalarfield.io/share-strategy/combined-spy-iwm-analyst-pead/JCQRLZxwwaIrLryBimiHYPo_T0U3wD9r1baTH8rrrEQ)

---

## What are we actually testing?

The goal is not simply to see whether the portfolio makes money.

There are several more interesting questions.

### Does PEAD still exist in modern markets?

The anomaly has been studied for decades.

Today's market has machine-readable filings, algorithmic trading, instant earnings alerts, social media, automated analyst models and much faster information processing.

If stocks with extreme positive SUE and EAR signals still drift upward afterward, that would suggest earnings information is still not incorporated instantaneously.

### Does the market reaction add information beyond the EPS beat?

This is perhaps the most interesting part of the strategy.

EAR asks whether the **market itself confirms that the earnings event was unusually important**.

The source research found EAR and SUE contained distinct information and that combining the two could improve the signal.

### Does the small-cap component survive actual execution?

Quantpedia notes that small-cap stocks have historically been important contributors to PEAD.

But small caps also introduce different liquidity, spread and execution characteristics.

The IWM portion of the universe therefore matters not just for return, but for testing whether the apparent small-cap anomaly survives practical trading.

### Does the 20-position cap help or hurt?

The academic strategy can hold every qualifying stock.

The production portfolio cannot.

So the agent records qualifying shadow signals even when there is no portfolio capacity.

Over time, we can compare:

> Stocks actually held by the 20-position portfolio

with

> Qualifying PEAD signals that could not enter.

That lets us measure the impact of the portfolio constraint rather than guessing.

### Does the signal survive truly point-in-time data?

This is the most important test.

A historical database can accidentally know the future.

The live agent cannot.

From here forward, every earnings report, consensus estimate, price reaction, entry decision and fill occurs in sequence.

---

## Where we go from here

The historical result is interesting:

> **13.20% CAGR, 0.711 Sharpe, -31.61% maximum drawdown.**

But that is not the conclusion of the experiment.

It is the reason to run the experiment.

The universe is now fixed.

The SUE definition is fixed.

The EAR definition is fixed.

The eligibility thresholds are fixed.

The entry timing is fixed.

The 60-day holding rule is fixed.

The 20-position constraint is fixed.

The risk controls are fixed.

And, most importantly, future signals will be generated using information actually available when the agent sees it.

The question is no longer:

> **Can PEAD be made to look interesting in historical data?**

It is:

> **Does the earnings drift survive when we have to trade it prospectively?**

[Follow the Combined SPY-IWM Analyst PEAD agent on Scalar Field →](https://scalarfield.io/share-strategy/combined-spy-iwm-analyst-pead/JCQRLZxwwaIrLryBimiHYPo_T0U3wD9r1baTH8rrrEQ)

## Further reading

- [Quantpedia — Post-Earnings Announcement Effect](https://quantpedia.com/strategies/post-earnings-announcement-effect)
- [Scalar Field — Combined SPY-IWM Analyst PEAD](https://scalarfield.io/share-strategy/combined-spy-iwm-analyst-pead/JCQRLZxwwaIrLryBimiHYPo_T0U3wD9r1baTH8rrrEQ)