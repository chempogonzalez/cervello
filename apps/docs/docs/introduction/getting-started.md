---
sidebar_position: 1
id: getting-started
title: Getting started with Cervello
description: 'Introduction > Getting Started: Resources to get started learning and using Cervello'
---

> 🤯 Simplest and truly reactive state manager for React _(just 1.5kb)_

Cervello is a simple, reactive, tiny and fast state-management library for React

It's **as simple as reassign a new value** to the store properties. It will make an immutable change to the store and notify all the components subscribed
to that property or the whole store.

:::info v2 Breaking Changes
From v2.0.0, Cervello has 0 dependencies and it drops the React 17 compatibility. Now, React 18 is mandatory.

_If you still need to use Cervello with React 17, you can keep using the v1.2.1 which is the latest stable version._
:::

## Features

- ⚛️ Truly reactive on store change **_(nested properties too 🚀!!)_**
- ✅ Super simple and minimalistic API
- 🐨 Listen properties lazily
- 👌 No unnecessary re-renders
- 🔒 Immutable changes
- 🔑 Typescript support

## Installation

#### NPM

```bash
npm install @cervello/react
```

#### PNPM

```bash
pnpm add @cervello/react
```

#### YARN

```bash
yarn add @cervello/react
```
