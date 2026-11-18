# Business questions — Superstore Sample

8 stored questions. Full definitions are under `businessQuestions` in [layer.json](layer.json).
Build every chart from one of these (or add one) rather than composing ad-hoc queries in the app.

## Does discounting cost us profit?

Sales and profit at each discount level.

- **Measures:** Sales, Profit
- **By:** Orders.Discount

## How did sales and profit move through the year?

Sales and profit over the order date.

- **Measures:** Sales, Profit
- **By:** Order Date

## How do the segments compare on sales and margin?

Sales, profit and profit ratio for Consumer, Corporate and Home Office.

- **Measures:** Sales, Profit, Profit Ratio
- **By:** Segment

## What does each ship mode deliver?

Orders, sales and profit by ship mode.

- **Measures:** Sales, Orders, Profit
- **By:** Orders.Ship Mode

## Where do sales and profit sit by category?

Sales and profit for each category broken down by sub-category.

- **Measures:** Sales, Profit
- **By:** Category, Sub-Category

## Which states sell the most?

Sales and profit by state, largest sales first.

- **Measures:** Sales, Profit
- **By:** Orders.State

## Which sub-categories lose money?

Profit and sales for every sub-category, worst profit first.

- **Measures:** Sales, Profit
- **By:** Sub-Category

## Who are the most profitable customers?

The ten customers contributing the most profit, with their sales.

- **Measures:** Sales, Profit
- **By:** Orders.Customer Name
