# Business questions — Harbourline Hotels

28 stored questions. Full definitions are under `businessQuestions` in [layer.json](layer.json).
Build every chart from one of these (or add one) rather than composing ad-hoc queries in the app.

## How do hotels compare on occupancy, ADR and Net RevPAR?

Occupancy, ADR, RevPAR and Net RevPAR (after acquisition cost) by hotel, Jan–Oct 2026, with Net RevPAR growth on last year.

- **Measures:** Occupancy YTD, ADR YTD, RevPAR YTD, Net RevPAR YTD, Net RevPAR YoY
- **By:** Hotel

## How does each city compare with last autumn, and what share of revenue does it carry?

Occupancy and room revenue per city, Aug–Oct 2026, against Aug–Oct 2025, with each city's share of portfolio room revenue.

- **Measures:** Occupancy L3M, Occupancy L3M vs LY, Room Revenue L3M, Room Revenue L3M YoY, Room Revenue Share L3M
- **By:** City

## How does each city compare with last autumn?

Occupancy and room revenue by city, Aug–Oct 2026 against Aug–Oct 2025.

- **Measures:** Occupancy L3M, Occupancy L3M vs LY, Room Revenue L3M, Room Revenue L3M YoY
- **By:** City

## How does length of stay vary by channel?

Room nights by channel and length-of-stay band, with average length of stay, Jan–Oct 2026.

- **Measures:** Room Nights YTD, Average Length of Stay YTD
- **By:** Channel, Length of Stay

## How full was each city night by night, this autumn and last?

Occupancy and room nights by city and night, Aug–Oct 2026 and Aug–Oct 2025: the governed rows the browser joins to the weather.

- **Measures:** Occupancy, Room Nights
- **By:** City, Stay Date

## How full were the hotels night by night this autumn?

Occupancy by night of stay, Aug–Oct 2026.

- **Measures:** Occupancy L3M
- **By:** Stay Date

## How has the channel mix shifted month by month?

Room nights by month and channel group, Jan 2025 – Oct 2026.

- **Measures:** Room Nights
- **By:** Month, Channel Group

## How is room revenue converting to contribution month by month?

Monthly room revenue, acquisition cost and contribution across the portfolio, Jan 2025 – Oct 2026.

- **Measures:** Room Revenue, Acquisition Cost, Contribution
- **By:** Month

## How much did rooms earn night by night this autumn?

Room revenue by night of stay, Aug–Oct 2026.

- **Measures:** Room Revenue L3M
- **By:** Stay Date

## How much of the opportunity is already being acted on?

Estimated opportunity against open target value and achieved value by hotel.

- **Measures:** Estimated Opportunity, Open Target Value, Achieved Value
- **By:** Hotel

## What did rooms earn this autumn against last?

Room revenue, Aug–Oct 2026, and its growth on Aug–Oct 2025.

- **Measures:** Room Revenue L3M, Room Revenue L3M YoY

## What does it cost to turn room revenue into contribution?

Waterfall from room revenue through commissions, transaction fees, loyalty and marketing and variable room cost to contribution, Jan–Oct 2026.

- **Measures:** Room Revenue YTD, Commission Cost YTD, Transaction Fees YTD, Loyalty & Marketing Cost YTD, Net Room Revenue YTD, Variable Room Cost YTD, Contribution YTD

## What was occupancy this autumn against last?

Occupancy, Aug–Oct 2026, and the change in points on Aug–Oct 2025.

- **Measures:** Occupancy L3M, Occupancy L3M vs LY

## What would a wet-night offer add to this autumn's room revenue?

Baseline against scenario for Aug–Oct 2026: room revenue and occupancy as booked, and with a wet-night offer (parameters wet_share, occ_uplift_pts, rate_discount_pct).

- **Measures:** Room Revenue L3M, Room Revenue L3M Wet-Night Offer, Wet-Night Offer Revenue Change L3M, Occupancy L3M, Occupancy L3M Wet-Night Offer

## What would shifting room nights between channels be worth?

Each opportunity: room nights to move, from and to channel, and estimated annual value (simplified: unchanged demand and rate, no displacement).

- **Measures:** Opportunity Room Nights, Opportunity Cost Gap, Estimated Opportunity
- **By:** Hotel, Opportunity Type, Channel, Shift To Channel

## What would the wet-night offer's extra nights earn, and what would its discount cost?

Bridge from room revenue as booked (Aug–Oct 2026) to the wet-night offer scenario: the extra wet-night nights at the discounted rate, less the discount to guests already booked.

- **Measures:** Room Revenue L3M, Wet-Night Offer Extra Nights Revenue L3M, Wet-Night Offer Discount Cost L3M, Room Revenue L3M Wet-Night Offer

## Where does each city rank on this autumn's room revenue?

Each city's room revenue, Aug–Oct 2026, its rank and its share of the portfolio.

- **Measures:** Room Revenue L3M, Room Revenue L3M, Room Revenue Share L3M
- **By:** City

## Where is OTA dependence rising?

OTA, direct and wholesale share of room nights by hotel, Jan–Oct 2026, with the change on last year in percentage points.

- **Measures:** OTA Share YTD, OTA Share YTD vs PY, Direct Share YTD, Direct Share YTD vs PY, Wholesale Share YTD
- **By:** Hotel

## Where is the biggest estimated profit opportunity?

Estimated annual value of channel-mix opportunities by hotel (last 12 months basis; simplified, ignores demand change and displacement).

- **Measures:** Estimated Opportunity, Opportunity Room Nights
- **By:** Hotel

## Which actions are blocked or due soonest?

Every action with hotel, owner, priority and due date, its current status counts and open target value.

- **Measures:** Blocked Actions, Open Actions, Open Target Value
- **By:** Action, Hotel, Action Owner, Action Priority, Due Date

## Which booking channels are weakening the result?

Room nights, acquisition cost and contribution per room night by channel, Jan–Oct 2026, with room-night growth on last year.

- **Measures:** Acquisition Cost YTD, Acquisition Cost % YTD, Room Nights YTD, Room Nights YoY, Contribution per Room Night YTD
- **By:** Channel

## Which cities earn the most room revenue this autumn?

Room revenue by hotel city, Aug–Oct 2026. Hotel × weather blending example.

- **Measures:** Room Revenue L3M
- **By:** City

## Which cities would gain most from a wet-night offer?

Room revenue a wet-night offer adds per city, Aug–Oct 2026, at the offer's parameters.

- **Measures:** Wet-Night Offer Revenue Change L3M
- **By:** City

## Which hotels grew revenue but kept less of it?

Room revenue and contribution by hotel, Jan–Oct 2026 against Jan–Oct 2025, with the change in acquisition cost that explains the gap. Weakest contribution growth first.

- **Measures:** Room Revenue YTD, Room Revenue YoY, Contribution YTD, Contribution YoY, Acquisition Cost % YTD, Acquisition Cost % YTD vs PY
- **By:** Hotel

## Which nights of the week earn the most per room night?

ADR, net ADR and contribution per room night by night of the week, Jan–Oct 2026.

- **Measures:** ADR YTD, Net ADR YTD, Contribution per Room Night YTD, Room Nights YTD
- **By:** Day of Week

## Which saved scenarios save the most acquisition cost?

Saved scenarios by hotel with room nights shifted and estimated acquisition-cost saving. Reads the writeback table live.

- **Measures:** Scenario Acquisition Saving, Scenario Room Nights Shifted
- **By:** Scenario, Hotel

## Which segments contribute most after acquisition cost?

Room revenue, acquisition cost rate, contribution and contribution margin by market segment, Jan–Oct 2026.

- **Measures:** Contribution YTD, Room Revenue YTD, Acquisition Cost % YTD, Contribution Margin % YTD
- **By:** Segment

## Who owns the open commercial actions?

Open, blocked and completed actions and their open target value by owner. Reads the action log live.

- **Measures:** Open Target Value, Open Actions, Blocked Actions, Done Actions
- **By:** Action Owner
