# M2 migration boundary

No SQL is applied in M1. M2 must introduce all requested tables with UUID keys, NUMERIC amounts, ownership and membership constraints, RLS, indexes, timestamps, audit history and atomic shared transaction functions. Authorization tests must cover outsider, owner, member, role changes and removed members. No real data should be entered before those checks pass.
