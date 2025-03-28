import Link from '@docusaurus/Link'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import Layout from '@theme/Layout'
import clsx from 'clsx'
import React from 'react'

import styles from './index.module.css'
import CodeBlock from '@theme/CodeBlock';



function HomepageHeader () {
  const { siteConfig } = useDocusaurusContext()
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <style>
        {`.text-left { text-align: left; }
.mx-auto { margin: 0 auto; }
.max-w-sm { max-width: 45rem; }
ul { list-style-type: none; padding-left: 0; text-align: left; margin: 2rem auto; padding: 2rem; background: rgba(249,249,249,2%); border-radius: 10px; }
.mt-12 { margin-top: 4rem; }
`}
      </style>
      <div className='container'>
        <img height='110' width='110' src='img/icon-home.png' />
        <h1 className='hero__title'>{siteConfig.title}</h1>
        <p className='hero__subtitle'><strong>{siteConfig.tagline}</strong></p>
        <p className='text-left mx-auto max-w-sm mt-12'>
          Cervello is a simple, reactive, tiny and performant state-management library for React

          <br/><br/>
It's <strong>as simple as reassign a new value</strong> to the store properties. <br/>It will notify all the components using `useStore` hook to re-render with the new value.

        </p>

        <div className={styles.buttons}>
          <Link
            className='button button--secondary button--lg'
            to='/docs/introduction/getting-started'
          >
            Get started
          </Link>
        </div>
        <ul className='max-w-sm'>
          <li> ⚛️ Reactive with store object changes <strong><i>(nested properties too 🚀!!)</i></strong></li>
<li>✅ Simple & minimalistic API</li>
<li>🚀 Batched updates and optimized re-renders</li>
<li> 🐨 Lazy listen nested properties</li>
<li> 🔒 Immutable changes</li>
<li> 🔑 Typescript support</li>

        </ul>
        <div className='container'>
          <style>
            {`
.code-blockk {
max-width: 600px;
padding-left: 20px;
padding-bottom: 20px;
margin: 0 auto;
margin-top: 60px;
margin-bottom: 180px;
text-align: left;
}
`}
          </style>
          <CodeBlock language='ts' className={'code-blockk'}>
            {`

import { cervello } from '@cervello/react'


export const {
  store,       // object with reactive changes
  useStore,    // Hook to be used in the components
  reset,       // Function to reset the store 
} = cervello({
  fullName: 'Cervello Store',
  address: {
    city: 'Huelva',
  },
})


// Change value from anywhere
store.address.city = 'Sevilla'


// Listen for changes from components
function Address() {
  const { address } = useStore()
  return (<p>City: {address.city}</p>)
}
`}
          </CodeBlock>
        </div>
      </div>
    </header>
  )
}

export default function Home (): JSX.Element {
  const { siteConfig } = useDocusaurusContext()
  return (
    <Layout
      title={siteConfig.title}
      description='🤯 Simplest and truly reactive state manager for React'
    >
      <HomepageHeader />
      {/* <main>
        <HomepageFeatures />
      </main> */}
    </Layout>
  )
}
