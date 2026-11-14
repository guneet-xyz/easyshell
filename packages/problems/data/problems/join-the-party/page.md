# Problem Statement

The database is down. Again. (No, it's not the port this time. You checked. Twice.)

Your boss doesn't care. Your boss is throwing a party for the shop's **biggest spenders**, the invitations have to go out today, and "the database is down" is "not an answer, it's an excuse".

All you have are yesterday's exports:

- `orders.csv`, with one row per order:

  ```csv
  order_id,customer_id,amount
  1001,1,420.69
  1002,2,12.50
  1004,1,0.31
  ```

- `customers.csv`, with one row per customer:

  ```csv
  customer_id,name
  1,Melon Usk
  2,Grandma
  ```

The orders know who paid but not their names, and the customers know their names but not what they paid. In SQL this would be a `JOIN`. In BusyBox there is no `join` command. There is, however, `awk`, and `awk` has a very good memory.

# Instructions

1. Both files are comma-separated and start with a header row. Fields never contain commas or quotes.
2. Add up the `amount` of all orders of each customer. Every `customer_id` in `orders.csv` exists in `customers.csv`, and customer names are unique.
3. Print one line per customer with **at least one order**, formatted as `<name>,<total>`. Customers without orders don't get invited (sorry, Kevin).
4. Print each total with exactly two decimal places (`421.00`, `7.50`). Amounts in `orders.csv` have at most two decimal places, but they may have fewer (`20`, `7.5`).
5. Sort the lines by total, largest first. If two customers have the same total, sort them by name in alphabetical order.
6. The rows of both files can be in any order. Don't print a header.

# Example

For the files above, the output is:

```csv
Melon Usk,421.00
Grandma,12.50
```
