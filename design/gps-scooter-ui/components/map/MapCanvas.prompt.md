Fills the screen behind every map view; overlays are absolutely positioned children.

```jsx
<MapCanvas routes={[{ d:"M600 330 L600 1700", color:"var(--route-active)", glow:true }]}>
  <LocationPuck style={{position:"absolute",left:"48%",top:"55%"}} />
</MapCanvas>
```

Route colors carry meaning: blue = active guidance, green = recommended, amber dotted = caution, red dotted = hazard.
