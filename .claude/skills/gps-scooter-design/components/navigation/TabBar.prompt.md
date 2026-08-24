Root navigation — three destinations, floating above the home indicator with 20px side gutters.

```jsx
<TabBar active="explore" onChange={setTab} items={[
  {id:"explore", label:"Explorar", icon:"map"},
  {id:"saved", label:"Salvos", icon:"star"},
  {id:"activity", label:"Atividade", icon:"clock"},
]} />
```

Active tab: blue-tinted capsule, blue icon, white label. Inactive: tertiary icon and label.
