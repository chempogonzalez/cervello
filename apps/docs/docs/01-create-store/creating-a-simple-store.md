---
sidebar_position: 1
---

# Creating a simple store

```tsx title="simple-store.ts"

import { cervello } from '@cervello/react'

/**
 * The cervello function returns:
 * - reactive store
 * - 2 hooks to be ready to changes inside react components
 *
 */
export const { store, useStore, useSelector } = cervello({ count: 0 })
