/* @ds-bundle: {"format":4,"namespace":"GPSScooterDesignSystem_7b8022","components":[{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Chip","sourcePath":"components/core/Chip.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"SectionLabel","sourcePath":"components/core/SectionLabel.jsx"},{"name":"StatTile","sourcePath":"components/core/StatTile.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"},{"name":"ListRow","sourcePath":"components/data/ListRow.jsx"},{"name":"SkeletonRow","sourcePath":"components/data/SkeletonRow.jsx"},{"name":"RouteSearchField","sourcePath":"components/forms/RouteSearchField.jsx"},{"name":"SearchField","sourcePath":"components/forms/SearchField.jsx"},{"name":"SettingsRow","sourcePath":"components/forms/SettingsRow.jsx"},{"name":"Toggle","sourcePath":"components/forms/Toggle.jsx"},{"name":"BottomSheet","sourcePath":"components/map/BottomSheet.jsx"},{"name":"LocationPuck","sourcePath":"components/map/LocationPuck.jsx"},{"name":"MapCanvas","sourcePath":"components/map/MapCanvas.jsx"},{"name":"NavStatsBar","sourcePath":"components/map/NavStatsBar.jsx"},{"name":"RouteOptionCard","sourcePath":"components/map/RouteOptionCard.jsx"},{"name":"StatPill","sourcePath":"components/map/StatPill.jsx"},{"name":"VehicleStatusBar","sourcePath":"components/map/VehicleStatusBar.jsx"},{"name":"GuidanceBanner","sourcePath":"components/navigation/GuidanceBanner.jsx"},{"name":"NavHeader","sourcePath":"components/navigation/NavHeader.jsx"},{"name":"StatusBar","sourcePath":"components/navigation/StatusBar.jsx"},{"name":"HomeIndicator","sourcePath":"components/navigation/StatusBar.jsx"},{"name":"TabBar","sourcePath":"components/navigation/TabBar.jsx"}],"sourceHashes":{"components/core/Avatar.jsx":"2d276b896001","components/core/Button.jsx":"036f8cb0e095","components/core/Card.jsx":"2915a06d377b","components/core/Chip.jsx":"f726fd95f56a","components/core/Icon.jsx":"56aedbd7a667","components/core/IconButton.jsx":"94334d206089","components/core/SectionLabel.jsx":"91635ca17bc9","components/core/StatTile.jsx":"33a859b41315","components/core/Tag.jsx":"80cc94dfee29","components/data/ListRow.jsx":"b178293a783b","components/data/SkeletonRow.jsx":"3deabe43fcd4","components/forms/RouteSearchField.jsx":"a2caccfb00c7","components/forms/SearchField.jsx":"210fe5bfa5e2","components/forms/SettingsRow.jsx":"5851b2c86428","components/forms/Toggle.jsx":"384a50fce860","components/map/BottomSheet.jsx":"4ce47432151c","components/map/LocationPuck.jsx":"1aecc7cdee76","components/map/MapCanvas.jsx":"299f8507c728","components/map/NavStatsBar.jsx":"e939c162294b","components/map/RouteOptionCard.jsx":"8cb3c7599ae0","components/map/StatPill.jsx":"1a7e3ae17b23","components/map/VehicleStatusBar.jsx":"137dd9c505ce","components/navigation/GuidanceBanner.jsx":"7bb0fd64a364","components/navigation/NavHeader.jsx":"c8491279150f","components/navigation/StatusBar.jsx":"02aa5f93ea82","components/navigation/TabBar.jsx":"9d14e5cd52b9","ui_kits/scooter-app/App.jsx":"2fbff2e2383a","ui_kits/scooter-app/DetailScreens.jsx":"1bf2f5f0299e","ui_kits/scooter-app/ExploreScreen.jsx":"c86c1c94cf97","ui_kits/scooter-app/ListScreens.jsx":"f74c1913d525","ui_kits/scooter-app/RouteScreens.jsx":"d6e42f1f3dc6","ui_kits/scooter-app/SearchScreen.jsx":"ba1bc332d918"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.GPSScooterDesignSystem_7b8022 = window.GPSScooterDesignSystem_7b8022 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Avatar({
  src,
  name = "",
  size = 48,
  ring = false,
  style,
  ...rest
}) {
  const initials = name.split(" ").slice(0, 2).map(function (w) {
    return w.charAt(0);
  }).join("").toUpperCase();
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      width: size,
      height: size,
      minWidth: size,
      borderRadius: "var(--radius-pill)",
      overflow: "hidden",
      background: "var(--surface-tile)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--text-secondary)",
      fontWeight: "var(--fw-extrabold)",
      fontSize: size * 0.36,
      boxShadow: ring ? "var(--ring-accent-soft)" : "none",
      ...style
    }
  }, rest), src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name,
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  }) : initials);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const BASE = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  fontFamily: "var(--font-core)",
  fontWeight: "var(--fw-extrabold)",
  border: "none",
  cursor: "pointer",
  width: "100%",
  transition: "transform var(--dur-fast) var(--ease-standard), opacity var(--dur-fast) var(--ease-standard), background var(--dur-fast) var(--ease-standard)"
};
const SIZES = {
  lg: {
    height: "56px",
    fontSize: "18px",
    borderRadius: "var(--radius-lg)",
    padding: "0 24px"
  },
  md: {
    height: "48px",
    fontSize: "16px",
    borderRadius: "var(--radius-md)",
    padding: "0 20px"
  },
  sm: {
    height: "36px",
    fontSize: "14px",
    borderRadius: "var(--radius-pill)",
    padding: "0 14px"
  }
};
const VARIANTS = {
  go: {
    background: "var(--accent-go)",
    color: "var(--text-on-accent)"
  },
  primary: {
    background: "var(--accent-primary)",
    color: "var(--text-on-accent)"
  },
  secondary: {
    background: "var(--surface-card-raised)",
    color: "var(--text-primary)"
  },
  quiet: {
    background: "var(--blue-a16)",
    color: "var(--text-accent)"
  },
  ghost: {
    background: "transparent",
    color: "var(--text-accent)"
  },
  destructive: {
    background: "var(--surface-card)",
    color: "var(--accent-danger)"
  }
};
function Button({
  variant = "primary",
  size = "lg",
  disabled = false,
  icon = null,
  children,
  style,
  onClick,
  ...rest
}) {
  const [down, setDown] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    disabled: disabled,
    onClick: onClick,
    onPointerDown: function () {
      setDown(true);
    },
    onPointerUp: function () {
      setDown(false);
    },
    onPointerLeave: function () {
      setDown(false);
    },
    style: {
      ...BASE,
      ...SIZES[size],
      ...VARIANTS[variant],
      opacity: disabled ? 0.4 : down ? "var(--press-dim)" : 1,
      transform: down && !disabled ? "scale(var(--press-scale))" : "scale(1)",
      cursor: disabled ? "not-allowed" : "pointer",
      ...style
    }
  }, rest), icon, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TONES = {
  card: "var(--surface-card)",
  raised: "var(--surface-card-raised)",
  sunken: "var(--surface-sunken)",
  overlay: "var(--surface-overlay)"
};
function Card({
  tone = "card",
  selected = false,
  padded = true,
  blur = false,
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: TONES[tone],
      borderRadius: "var(--radius-xl)",
      padding: padded ? "var(--card-pad-y) var(--card-pad-x)" : 0,
      border: selected ? "var(--border-width-selected) solid var(--border-selected)" : "var(--border-width) solid var(--border-hairline)",
      backdropFilter: blur ? "blur(20px)" : "none",
      WebkitBackdropFilter: blur ? "blur(20px)" : "none",
      transition: "border-color var(--dur-base) var(--ease-standard), background var(--dur-base) var(--ease-standard)",
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Chip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Chip({
  children,
  selected = false,
  onClick,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    onClick: onClick,
    style: {
      height: "40px",
      padding: "0 20px",
      borderRadius: "var(--radius-pill)",
      background: selected ? "var(--blue-a16)" : "var(--surface-card-raised)",
      color: selected ? "var(--text-accent)" : "var(--text-primary)",
      border: selected ? "1px solid var(--border-selected)" : "1px solid transparent",
      fontFamily: "var(--font-core)",
      fontSize: "15px",
      fontWeight: "var(--fw-bold)",
      cursor: "pointer",
      whiteSpace: "nowrap",
      transition: "background var(--dur-base) var(--ease-standard), color var(--dur-base) var(--ease-standard)",
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Chip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Chip.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Loads the Lucide UMD build once, on demand. Lucide is a SUBSTITUTION for the
   source app's icon set (screenshots only, no vector source was provided) —
   stroke weight ~2 / rounded caps matches the screenshots closely. */
const LUCIDE_URL = "https://unpkg.com/lucide@0.469.0/dist/umd/lucide.js";
let lucidePromise = null;
function loadLucide() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.lucide) return Promise.resolve(window.lucide);
  if (lucidePromise) return lucidePromise;
  lucidePromise = new Promise(function (resolve) {
    var s = document.createElement("script");
    s.src = LUCIDE_URL;
    s.onload = function () {
      resolve(window.lucide);
    };
    s.onerror = function () {
      resolve(null);
    };
    document.head.appendChild(s);
  });
  return lucidePromise;
}
function Icon({
  name,
  size = 20,
  color = "currentColor",
  strokeWidth = 2,
  style,
  ...rest
}) {
  const host = React.useRef(null);
  React.useEffect(function () {
    let alive = true;
    loadLucide().then(function (lucide) {
      if (!alive || !lucide || !host.current) return;
      host.current.innerHTML = '<i data-lucide="' + name + '"></i>';
      lucide.createIcons({
        nameAttr: "data-lucide",
        attrs: {
          width: size,
          height: size,
          stroke: color,
          "stroke-width": strokeWidth
        }
      });
    });
    return function () {
      alive = false;
    };
  }, [name, size, color, strokeWidth]);
  return /*#__PURE__*/React.createElement("span", _extends({
    ref: host,
    "aria-hidden": "true",
    style: {
      display: "inline-flex",
      width: size,
      height: size,
      flex: "0 0 auto",
      color: color,
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SHAPES = {
  circle: "var(--radius-pill)",
  square: "var(--radius-md)"
};
const TONES = {
  neutral: {
    background: "var(--surface-tile)",
    color: "var(--text-secondary)"
  },
  accent: {
    background: "var(--accent-primary)",
    color: "var(--text-on-accent)"
  },
  quiet: {
    background: "transparent",
    color: "var(--text-secondary)"
  },
  overlay: {
    background: "var(--surface-overlay)",
    color: "var(--text-secondary)"
  }
};
function IconButton({
  icon,
  label,
  tone = "quiet",
  shape = "circle",
  size = 44,
  iconSize = 20,
  style,
  onClick,
  ...rest
}) {
  const [down, setDown] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-label": label,
    onClick: onClick,
    onPointerDown: function () {
      setDown(true);
    },
    onPointerUp: function () {
      setDown(false);
    },
    onPointerLeave: function () {
      setDown(false);
    },
    style: {
      width: size,
      height: size,
      minWidth: size,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      border: "none",
      cursor: "pointer",
      borderRadius: SHAPES[shape],
      ...TONES[tone],
      opacity: down ? "var(--press-dim)" : 1,
      transform: down ? "scale(var(--press-scale))" : "scale(1)",
      transition: "transform var(--dur-fast) var(--ease-standard), opacity var(--dur-fast) var(--ease-standard)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: iconSize
  }));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/SectionLabel.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function SectionLabel({
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      fontFamily: "var(--font-core)",
      fontSize: "var(--type-eyebrow-size)",
      fontWeight: "var(--type-eyebrow-weight)",
      letterSpacing: "var(--type-eyebrow-track)",
      textTransform: "uppercase",
      color: "var(--text-tertiary)",
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { SectionLabel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/SectionLabel.jsx", error: String((e && e.message) || e) }); }

// components/core/StatTile.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TONES = {
  default: "var(--text-primary)",
  go: "var(--accent-go)",
  accent: "var(--accent-primary)"
};
function StatTile({
  label,
  value,
  tone = "default",
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: "var(--surface-card)",
      borderRadius: "var(--radius-lg)",
      border: "var(--border-width) solid var(--border-hairline)",
      padding: "14px 16px 16px",
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--type-eyebrow-size)",
      fontWeight: "var(--type-eyebrow-weight)",
      letterSpacing: "var(--type-eyebrow-track)",
      textTransform: "uppercase",
      color: "var(--text-tertiary)"
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--type-metric-size)",
      fontWeight: "var(--type-metric-weight)",
      lineHeight: "var(--type-metric-lh)",
      letterSpacing: "var(--type-metric-track)",
      color: TONES[tone]
    }
  }, value));
}
Object.assign(__ds_scope, { StatTile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/StatTile.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TONES = {
  go: {
    background: "var(--green-a16)",
    color: "var(--green-400)"
  },
  accent: {
    background: "var(--blue-a16)",
    color: "var(--blue-400)"
  },
  warn: {
    background: "var(--amber-a16)",
    color: "var(--amber-500)"
  },
  danger: {
    background: "var(--red-a16)",
    color: "var(--red-500)"
  },
  neutral: {
    background: "var(--surface-tile)",
    color: "var(--text-secondary)"
  }
};
function Tag({
  tone = "neutral",
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: "inline-flex",
      alignItems: "center",
      height: "24px",
      padding: "0 10px",
      borderRadius: "var(--radius-sm)",
      ...TONES[tone],
      fontFamily: "var(--font-core)",
      fontSize: "var(--type-tag-size)",
      fontWeight: "var(--type-tag-weight)",
      letterSpacing: "var(--type-tag-track)",
      textTransform: "uppercase",
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

// components/data/ListRow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TILE_TONES = {
  neutral: {
    background: "var(--surface-tile)",
    color: "var(--text-secondary)"
  },
  accent: {
    background: "var(--blue-a16)",
    color: "var(--accent-primary)"
  },
  warn: {
    background: "var(--surface-tile)",
    color: "var(--accent-warn)"
  },
  go: {
    background: "var(--surface-tile)",
    color: "var(--accent-go)"
  }
};

/* The universal list row: icon tile, title, subtitle, and a trailing value or chevron.
   Covers search results, saved places and ride history in the source screens. */
function ListRow({
  icon,
  iconShape = "square",
  tone = "neutral",
  title,
  subtitle,
  trailing,
  chevron = false,
  divider = false,
  onClick,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    onClick: onClick,
    style: {
      display: "flex",
      alignItems: "center",
      gap: "16px",
      minHeight: "var(--row-min-height)",
      padding: "12px 16px",
      borderRadius: "var(--radius-xl)",
      background: divider ? "transparent" : "var(--surface-card)",
      border: divider ? "none" : "var(--border-width) solid var(--border-hairline)",
      borderBottom: divider ? "var(--border-width) solid var(--border-hairline)" : undefined,
      cursor: onClick ? "pointer" : "default",
      ...style
    }
  }, rest), icon && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 52,
      height: 52,
      flex: "0 0 auto",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: iconShape === "circle" ? "var(--radius-pill)" : "var(--radius-md)",
      ...TILE_TONES[tone]
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 24
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--type-row-title-size)",
      fontWeight: "var(--type-row-title-weight)",
      lineHeight: "var(--type-row-title-lh)",
      color: "var(--text-primary)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, title), subtitle && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--type-body-size)",
      color: "var(--text-secondary)",
      marginTop: "3px",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, subtitle)), trailing && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "16px",
      fontWeight: "var(--fw-bold)",
      color: "var(--text-secondary)"
    }
  }, trailing), chevron && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-right",
    size: 20,
    color: "var(--text-tertiary)"
  }));
}
Object.assign(__ds_scope, { ListRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/ListRow.jsx", error: String((e && e.message) || e) }); }

// components/data/SkeletonRow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Loading placeholder shaped like ListRow. Static bars — no shimmer in the source. */
function SkeletonRow({
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      alignItems: "center",
      gap: "16px",
      padding: "12px 16px",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 52,
      height: 52,
      borderRadius: "var(--radius-pill)",
      background: "var(--surface-card-raised)",
      flex: "0 0 auto"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      gap: "10px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 14,
      width: "70%",
      borderRadius: "var(--radius-pill)",
      background: "var(--surface-card-raised)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 12,
      width: "45%",
      borderRadius: "var(--radius-pill)",
      background: "var(--surface-card-raised)"
    }
  })));
}
Object.assign(__ds_scope, { SkeletonRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/SkeletonRow.jsx", error: String((e && e.message) || e) }); }

// components/forms/RouteSearchField.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* The floating origin -> destination bar that sits over the map on the explore screen. */
function RouteSearchField({
  origin = "Sua localização",
  destination = "Para onde?",
  avatarSrc,
  onSearch,
  onPress,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    onClick: onPress,
    style: {
      display: "flex",
      alignItems: "center",
      gap: "14px",
      padding: "12px 16px",
      background: "var(--surface-overlay)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      borderRadius: "var(--radius-2xl)",
      border: "var(--border-width) solid var(--border-subtle)",
      boxShadow: "var(--shadow-float)",
      cursor: "pointer",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    src: avatarSrc,
    name: "A",
    size: 44
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      paddingBottom: "8px",
      borderBottom: "var(--border-width) solid var(--border-subtle)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: "var(--radius-pill)",
      background: "var(--accent-primary)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-secondary)",
      fontSize: "16px",
      fontWeight: "var(--fw-semibold)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, origin)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      paddingTop: "8px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: "var(--radius-pill)",
      background: "var(--text-tertiary)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-primary)",
      fontSize: "19px",
      fontWeight: "var(--fw-extrabold)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, destination))), /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Buscar",
    onClick: onSearch,
    style: {
      background: "none",
      border: "none",
      color: "var(--accent-primary)",
      cursor: "pointer",
      display: "flex",
      padding: "4px"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "search",
    size: 26,
    strokeWidth: 2.5
  })));
}
Object.assign(__ds_scope, { RouteSearchField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/RouteSearchField.jsx", error: String((e && e.message) || e) }); }

// components/forms/SearchField.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function SearchField({
  value = "",
  placeholder = "Para onde?",
  focused = false,
  onChange,
  onClear,
  onBack,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      ...style
    }
  }, rest), onBack && /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Voltar",
    onClick: onBack,
    style: {
      background: "none",
      border: "none",
      color: "var(--text-primary)",
      cursor: "pointer",
      padding: "8px",
      display: "flex"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "arrow-left",
    size: 24
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      gap: "10px",
      height: "52px",
      padding: "0 14px",
      background: "var(--surface-card)",
      borderRadius: "var(--radius-md)",
      border: focused ? "var(--border-width-selected) solid var(--border-selected)" : "var(--border-width) solid var(--border-hairline)",
      transition: "border-color var(--dur-base) var(--ease-standard)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: "var(--radius-pill)",
      background: "var(--accent-primary)",
      flex: "0 0 auto"
    }
  }), /*#__PURE__*/React.createElement("input", {
    value: value,
    placeholder: placeholder,
    onChange: onChange,
    style: {
      flex: 1,
      minWidth: 0,
      background: "transparent",
      border: "none",
      outline: "none",
      color: "var(--text-primary)",
      fontFamily: "var(--font-core)",
      fontSize: "17px",
      fontWeight: "var(--fw-bold)"
    }
  }), value && onClear && /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Limpar",
    onClick: onClear,
    style: {
      background: "none",
      border: "none",
      color: "var(--text-tertiary)",
      cursor: "pointer",
      display: "flex",
      padding: 0
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "circle-x",
    size: 22
  }))));
}
Object.assign(__ds_scope, { SearchField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/SearchField.jsx", error: String((e && e.message) || e) }); }

// components/forms/Toggle.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Toggle({
  checked = false,
  onChange,
  disabled = false,
  label,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    role: "switch",
    "aria-checked": checked,
    "aria-label": label,
    disabled: disabled,
    onClick: function () {
      if (onChange) onChange(!checked);
    },
    style: {
      width: "62px",
      height: "34px",
      padding: "3px",
      borderRadius: "var(--radius-pill)",
      border: "none",
      background: checked ? "var(--accent-go)" : "var(--ink-500)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.4 : 1,
      display: "flex",
      justifyContent: checked ? "flex-end" : "flex-start",
      alignItems: "center",
      transition: "background var(--dur-base) var(--ease-standard)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      width: "28px",
      height: "28px",
      borderRadius: "var(--radius-pill)",
      background: checked ? "var(--white)" : "var(--slate-200)",
      boxShadow: "var(--shadow-tile)",
      transition: "all var(--dur-base) var(--ease-out)"
    }
  }));
}
Object.assign(__ds_scope, { Toggle });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Toggle.jsx", error: String((e && e.message) || e) }); }

// components/forms/SettingsRow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* One row of a settings group: label on the left, and on the right either a
   toggle, a value string, an action link, or a chevron. */
function SettingsRow({
  label,
  icon,
  iconColor = "var(--accent-primary)",
  control = "none",
  checked,
  value,
  action,
  tone = "default",
  onChange,
  onClick,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    onClick: onClick,
    style: {
      display: "flex",
      alignItems: "center",
      gap: "14px",
      minHeight: "64px",
      padding: "0 18px",
      background: "var(--surface-card)",
      borderRadius: "var(--radius-lg)",
      border: "var(--border-width) solid var(--border-hairline)",
      cursor: onClick ? "pointer" : "default",
      ...style
    }
  }, rest), icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 24,
    color: iconColor
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontSize: "17px",
      fontWeight: "var(--fw-bold)",
      color: tone === "danger" ? "var(--accent-danger)" : "var(--text-primary)",
      textAlign: tone === "danger" ? "center" : "left"
    }
  }, label), control === "toggle" && /*#__PURE__*/React.createElement(__ds_scope.Toggle, {
    checked: checked,
    onChange: onChange,
    label: label
  }), control === "value" && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "16px",
      color: "var(--text-secondary)"
    }
  }, value), control === "action" && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "16px",
      fontWeight: "var(--fw-semibold)",
      color: "var(--text-accent)"
    }
  }, action), control === "chevron" && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-right",
    size: 20,
    color: "var(--text-tertiary)"
  }));
}
Object.assign(__ds_scope, { SettingsRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/SettingsRow.jsx", error: String((e && e.message) || e) }); }

// components/map/BottomSheet.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Bottom sheet anchored to the bottom of the map with a grabber handle. */
function BottomSheet({
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: "var(--surface-card)",
      borderTopLeftRadius: "var(--radius-2xl)",
      borderTopRightRadius: "var(--radius-2xl)",
      borderTop: "var(--border-width) solid var(--border-subtle)",
      boxShadow: "var(--shadow-sheet)",
      padding: "10px var(--screen-gutter) var(--safe-bottom)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 56,
      height: 5,
      borderRadius: "var(--radius-pill)",
      background: "var(--ink-500)",
      margin: "0 auto 16px"
    }
  }), children);
}
Object.assign(__ds_scope, { BottomSheet });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/map/BottomSheet.jsx", error: String((e && e.message) || e) }); }

// components/map/LocationPuck.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* The user's position marker. "idle" = filled blue dot in a soft halo,
   "navigating" = white ring riding the route line. */
function LocationPuck({
  variant = "idle",
  size = 22,
  style,
  ...rest
}) {
  const halo = size * 2.2;
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      width: halo,
      height: halo,
      borderRadius: "var(--radius-pill)",
      background: "var(--puck-halo)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      width: size,
      height: size,
      borderRadius: "var(--radius-pill)",
      background: variant === "navigating" ? "transparent" : "var(--puck-fill)",
      border: variant === "navigating" ? "5px solid var(--white)" : "none",
      boxShadow: "var(--glow-route)"
    }
  }));
}
Object.assign(__ds_scope, { LocationPuck });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/map/LocationPuck.jsx", error: String((e && e.message) || e) }); }

// components/map/MapCanvas.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Stylised dark basemap: faint grid, thick slate roads, POI dots, and any number of
   route lines drawn on top. Geometry is decorative — this is a visual stand-in for the
   real map tiles, matching the source app's dark cartography. */
const ROADS = [{
  d: "M330 30 L520 620 L500 1130",
  w: 26
}, {
  d: "M60 380 L940 800",
  w: 22
}, {
  d: "M160 660 L900 480",
  w: 20
}, {
  d: "M60 900 L960 1560",
  w: 34,
  opacity: 0.55
}, {
  d: "M60 1290 L820 1420",
  w: 18
}, {
  d: "M340 1900 L470 1060",
  w: 14
}];
const DOTS = [{
  x: 700,
  y: 460,
  r: 9
}, {
  x: 245,
  y: 530,
  r: 9
}, {
  x: 335,
  y: 1195,
  r: 9
}, {
  x: 600,
  y: 1470,
  r: 9
}];
function MapCanvas({
  routes = [],
  children,
  grid = true,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      position: "relative",
      width: "100%",
      height: "100%",
      background: "var(--bg-map)",
      overflow: "hidden",
      ...style
    }
  }, rest), grid && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      backgroundImage: "linear-gradient(var(--map-grid) 1px,transparent 1px),linear-gradient(90deg,var(--map-grid) 1px,transparent 1px)",
      backgroundSize: "120px 190px"
    }
  }), /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 1000 1900",
    preserveAspectRatio: "xMidYMid slice",
    style: {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%"
    }
  }, ROADS.map(function (r, i) {
    return /*#__PURE__*/React.createElement("path", {
      key: i,
      d: r.d,
      stroke: "var(--map-road)",
      strokeWidth: r.w,
      strokeLinecap: "round",
      fill: "none",
      opacity: r.opacity || 1
    });
  }), DOTS.map(function (d, i) {
    return /*#__PURE__*/React.createElement("circle", {
      key: i,
      cx: d.x,
      cy: d.y,
      r: d.r,
      fill: "var(--ink-500)"
    });
  }), routes.map(function (route, i) {
    return /*#__PURE__*/React.createElement("path", {
      key: i,
      d: route.d,
      stroke: route.color || "var(--route-active)",
      strokeWidth: route.width || 14,
      strokeLinecap: "round",
      strokeDasharray: route.dashed ? "2 26" : undefined,
      fill: "none",
      style: route.glow ? {
        filter: "drop-shadow(0 0 10px rgba(53,183,247,.55))"
      } : undefined
    });
  })), children);
}
Object.assign(__ds_scope, { MapCanvas });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/map/MapCanvas.jsx", error: String((e && e.message) || e) }); }

// components/map/NavStatsBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* The three-up ETA strip pinned above the home indicator during navigation. */
function NavStatsBar({
  stats = [],
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(" + stats.length + ",1fr)",
      gap: "8px",
      padding: "16px 12px",
      background: "var(--surface-overlay)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      borderRadius: "var(--radius-2xl)",
      border: "var(--border-width) solid var(--border-subtle)",
      boxShadow: "var(--shadow-float)",
      ...style
    }
  }, rest), stats.map(function (s, i) {
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: "27px",
        fontWeight: "var(--fw-extrabold)",
        lineHeight: 1.1,
        color: s.tone === "accent" ? "var(--accent-primary)" : "var(--text-primary)"
      }
    }, s.value), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: "14px",
        color: "var(--text-secondary)",
        marginTop: "4px"
      }
    }, s.label));
  }));
}
Object.assign(__ds_scope, { NavStatsBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/map/NavStatsBar.jsx", error: String((e && e.message) || e) }); }

// components/map/RouteOptionCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TAG_TONE = {
  recommended: "go",
  alternative: "warn",
  fast: "danger"
};

/* A selectable route choice: classification tag, distance, one-line rationale, and ETA. */
function RouteOptionCard({
  kind = "recommended",
  tagLabel,
  distance,
  description,
  duration,
  selected = false,
  onClick,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    onClick: onClick,
    style: {
      display: "flex",
      alignItems: "center",
      gap: "16px",
      padding: "14px 16px",
      background: selected ? "var(--surface-card-raised)" : "var(--surface-sunken)",
      borderRadius: "var(--radius-lg)",
      border: selected ? "var(--border-width-selected) solid var(--border-selected)" : "var(--border-width) solid var(--border-hairline)",
      cursor: "pointer",
      transition: "border-color var(--dur-base) var(--ease-standard), background var(--dur-base) var(--ease-standard)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "10px"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Tag, {
    tone: TAG_TONE[kind]
  }, tagLabel), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "15px",
      color: "var(--text-secondary)",
      fontWeight: "var(--fw-semibold)"
    }
  }, distance)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "6px",
      fontSize: "16px",
      color: selected ? "var(--text-primary)" : "var(--text-secondary)",
      textWrap: "pretty"
    }
  }, description)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "26px",
      fontWeight: "var(--fw-extrabold)",
      color: selected ? "var(--text-primary)" : "var(--text-secondary)",
      whiteSpace: "nowrap"
    }
  }, duration));
}
Object.assign(__ds_scope, { RouteOptionCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/map/RouteOptionCard.jsx", error: String((e && e.message) || e) }); }

// components/map/StatPill.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TONES = {
  default: "var(--text-primary)",
  go: "var(--accent-go)",
  accent: "var(--accent-primary)"
};

/* Small floating readout over the map — speed, battery, and similar live values. */
function StatPill({
  label,
  value,
  tone = "default",
  align = "left",
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "inline-flex",
      flexDirection: "column",
      gap: "4px",
      padding: "10px 16px",
      background: "var(--surface-overlay)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      borderRadius: "var(--radius-lg)",
      border: "var(--border-width) solid var(--border-subtle)",
      boxShadow: "var(--shadow-float)",
      textAlign: align,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--type-eyebrow-size)",
      fontWeight: "var(--type-eyebrow-weight)",
      letterSpacing: "var(--type-eyebrow-track)",
      textTransform: "uppercase",
      color: "var(--text-tertiary)"
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "24px",
      fontWeight: "var(--fw-extrabold)",
      color: TONES[tone]
    }
  }, value));
}
Object.assign(__ds_scope, { StatPill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/map/StatPill.jsx", error: String((e && e.message) || e) }); }

// components/map/VehicleStatusBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Connected-vehicle strip: model, link state, charge and remaining range. */
function VehicleStatusBar({
  model,
  connection = "Conectado via Bluetooth",
  battery,
  range,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      alignItems: "center",
      gap: "16px",
      padding: "14px 18px",
      background: "var(--surface-overlay)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      borderRadius: "var(--radius-2xl)",
      border: "var(--border-width) solid var(--border-subtle)",
      boxShadow: "var(--shadow-float)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "bike",
    size: 30,
    color: "var(--accent-go)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "19px",
      fontWeight: "var(--fw-extrabold)"
    }
  }, model), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "15px",
      color: "var(--text-secondary)",
      marginTop: "2px"
    }
  }, connection)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: "10px",
      whiteSpace: "nowrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "22px",
      fontWeight: "var(--fw-extrabold)",
      color: "var(--accent-go)"
    }
  }, battery), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "16px",
      color: "var(--text-secondary)"
    }
  }, range)));
}
Object.assign(__ds_scope, { VehicleStatusBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/map/VehicleStatusBar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/GuidanceBanner.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Turn-by-turn instruction banner floating at the top of the navigation screen. */
function GuidanceBanner({
  maneuver = "arrow-left",
  instruction,
  street,
  distance,
  onDismiss,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      alignItems: "center",
      gap: "16px",
      padding: "12px 14px",
      background: "var(--surface-overlay)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      borderRadius: "var(--radius-2xl)",
      border: "var(--border-width) solid var(--border-subtle)",
      boxShadow: "var(--shadow-float)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 60,
      height: 60,
      borderRadius: "var(--radius-lg)",
      background: "var(--accent-primary)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flex: "0 0 auto"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: maneuver,
    size: 30,
    color: "var(--text-on-accent)",
    strokeWidth: 2.5
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "21px",
      fontWeight: "var(--fw-extrabold)",
      lineHeight: 1.2
    }
  }, instruction), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "16px",
      color: "var(--text-secondary)",
      marginTop: "2px"
    }
  }, street, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-accent)",
      fontWeight: "var(--fw-bold)"
    }
  }, distance))), onDismiss && /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Encerrar navega\xE7\xE3o",
    onClick: onDismiss,
    style: {
      background: "var(--surface-tile)",
      border: "none",
      borderRadius: "var(--radius-pill)",
      width: 40,
      height: 40,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--text-secondary)",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "x",
    size: 20
  })));
}
Object.assign(__ds_scope, { GuidanceBanner });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/GuidanceBanner.jsx", error: String((e && e.message) || e) }); }

// components/navigation/NavHeader.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Two forms: "title" (large screen title, optional trailing action) and
   "back" (compact bar with a back chevron), both seen in the source screens. */
function NavHeader({
  title,
  variant = "title",
  action,
  onBack,
  style,
  ...rest
}) {
  if (variant === "back") {
    return /*#__PURE__*/React.createElement("div", _extends({
      style: {
        display: "flex",
        alignItems: "center",
        gap: "14px",
        minHeight: "56px",
        ...style
      }
    }, rest), /*#__PURE__*/React.createElement("button", {
      type: "button",
      "aria-label": "Voltar",
      onClick: onBack,
      style: {
        background: "none",
        border: "none",
        color: "var(--text-primary)",
        cursor: "pointer",
        display: "flex",
        padding: 0
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: "arrow-left",
      size: 26,
      strokeWidth: 2.5
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: "var(--type-nav-title-size)",
        fontWeight: "var(--type-nav-title-weight)",
        lineHeight: "var(--type-nav-title-lh)"
      }
    }, title));
  }
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "16px",
      minHeight: "56px",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: "var(--type-screen-title-size)",
      fontWeight: "var(--type-screen-title-weight)",
      lineHeight: "var(--type-screen-title-lh)",
      letterSpacing: "var(--type-screen-title-track)"
    }
  }, title), action);
}
Object.assign(__ds_scope, { NavHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/NavHeader.jsx", error: String((e && e.message) || e) }); }

// components/navigation/StatusBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* iOS status bar + home indicator used to frame every screen in the UI kit. */
function StatusBar({
  time = "09:41",
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      height: "var(--safe-top)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 28px",
      color: "var(--text-primary)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "17px",
      fontWeight: "var(--fw-bold)"
    }
  }, time), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "6px"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "signal-high",
    size: 18
  }), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "wifi",
    size: 18
  }), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "battery-full",
    size: 22
  })));
}
function HomeIndicator({
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      height: "var(--safe-bottom)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 140,
      height: 5,
      borderRadius: "var(--radius-pill)",
      background: "var(--slate-200)"
    }
  }));
}
Object.assign(__ds_scope, { StatusBar, HomeIndicator });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/StatusBar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/TabBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Floating pill tab bar, anchored above the home indicator. */
function TabBar({
  items = [],
  active,
  onChange,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      alignItems: "center",
      gap: "4px",
      padding: "6px",
      background: "var(--surface-overlay)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      borderRadius: "var(--radius-2xl)",
      border: "var(--border-width) solid var(--border-subtle)",
      boxShadow: "var(--shadow-float)",
      ...style
    }
  }, rest), items.map(function (item) {
    const on = item.id === active;
    return /*#__PURE__*/React.createElement("button", {
      key: item.id,
      type: "button",
      onClick: function () {
        if (onChange) onChange(item.id);
      },
      style: {
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        height: "52px",
        border: "none",
        borderRadius: "var(--radius-2xl)",
        cursor: "pointer",
        background: on ? "var(--blue-a16)" : "transparent",
        color: on ? "var(--text-primary)" : "var(--text-tertiary)",
        fontFamily: "var(--font-core)",
        fontSize: "16px",
        fontWeight: "var(--fw-bold)",
        transition: "background var(--dur-base) var(--ease-standard), color var(--dur-base) var(--ease-standard)"
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: item.icon,
      size: 22,
      color: on ? "var(--accent-primary)" : "var(--text-tertiary)"
    }), item.label);
  }));
}
Object.assign(__ds_scope, { TabBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/TabBar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/scooter-app/App.jsx
try { (() => {
function App() {
  const [view, setView] = React.useState("explore");
  const [tab, setTab] = React.useState("explore");
  function goTab(id) {
    setTab(id);
    setView(id);
  }
  if (view === "search") return /*#__PURE__*/React.createElement(SearchScreen, {
    onBack: function () {
      setView("explore");
    },
    onPick: function () {
      setView("routes");
    }
  });
  if (view === "routes") return /*#__PURE__*/React.createElement(RouteOptionsScreen, {
    onStart: function () {
      setView("navigating");
    }
  });
  if (view === "navigating") return /*#__PURE__*/React.createElement(NavigationScreen, {
    onStop: function () {
      setView("explore");
    }
  });
  if (view === "trip") return /*#__PURE__*/React.createElement(TripDetailScreen, {
    onBack: function () {
      setView("activity");
    }
  });
  if (view === "profile") return /*#__PURE__*/React.createElement(ProfileScreen, {
    onBack: function () {
      setView("explore");
    }
  });
  if (view === "saved") return /*#__PURE__*/React.createElement(SavedScreen, {
    tab: tab,
    onTab: goTab,
    onPick: function () {
      setView("routes");
    }
  });
  if (view === "activity") return /*#__PURE__*/React.createElement(ActivityScreen, {
    tab: tab,
    onTab: goTab,
    onPick: function () {
      setView("trip");
    }
  });
  return /*#__PURE__*/React.createElement(ExploreScreen, {
    tab: tab,
    onTab: goTab,
    onSearch: function () {
      setView("search");
    },
    onProfile: function () {
      setView("profile");
    }
  });
}
ReactDOM.createRoot(document.getElementById("phone")).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/scooter-app/App.jsx", error: String((e && e.message) || e) }); }

// ui_kits/scooter-app/DetailScreens.jsx
try { (() => {
const {
  StatusBar,
  HomeIndicator,
  NavHeader,
  MapCanvas,
  StatTile,
  Avatar,
  SectionLabel,
  SettingsRow,
  Icon
} = window.GPSScooterDesignSystem_7b8022;
function Endpoint({
  color,
  label,
  value
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "14px",
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 12,
      height: 12,
      borderRadius: "var(--radius-pill)",
      background: color,
      marginTop: "6px",
      flex: "0 0 auto"
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "17px",
      fontWeight: "var(--fw-bold)"
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "15px",
      color: "var(--text-secondary)",
      marginTop: "2px"
    }
  }, value)));
}
function TripDetailScreen({
  onBack
}) {
  return /*#__PURE__*/React.createElement(Screen, null, /*#__PURE__*/React.createElement(StatusBar, null), /*#__PURE__*/React.createElement(ScreenBody, {
    style: {
      gap: "20px"
    }
  }, /*#__PURE__*/React.createElement(NavHeader, {
    variant: "back",
    title: "Detalhes da Viagem",
    onBack: onBack
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 180,
      borderRadius: "var(--radius-xl)",
      overflow: "hidden",
      border: "1px solid var(--border-hairline)"
    }
  }, /*#__PURE__*/React.createElement(MapCanvas, {
    routes: [{
      d: "M380 250 L500 620",
      color: "var(--route-recommended)",
      width: 14
    }]
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "14px",
      paddingBottom: "18px",
      borderBottom: "1px solid var(--border-hairline)"
    }
  }, /*#__PURE__*/React.createElement(Endpoint, {
    color: "var(--accent-primary)",
    label: "Origem",
    value: "R. Pamplona, 145 - Jardins"
  }), /*#__PURE__*/React.createElement(Endpoint, {
    color: "var(--accent-go)",
    label: "Destino",
    value: "R. Augusta, 1005 - Consola\xE7\xE3o"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "12px"
    }
  }, /*#__PURE__*/React.createElement(StatTile, {
    label: "Dist\xE2ncia total",
    value: "1.8 km"
  }), /*#__PURE__*/React.createElement(StatTile, {
    label: "Tempo total",
    value: "8m 24s"
  }), /*#__PURE__*/React.createElement(StatTile, {
    label: "Velocidade m\xE9dia",
    value: "15.4 km/h"
  }), /*#__PURE__*/React.createElement(StatTile, {
    label: "Economia de CO\u2082",
    value: "240g",
    tone: "go"
  }))), /*#__PURE__*/React.createElement(HomeIndicator, null));
}
function ProfileScreen({
  onBack
}) {
  const [avoid, setAvoid] = React.useState(true);
  const [lanes, setLanes] = React.useState(true);
  const [hills, setHills] = React.useState(false);
  return /*#__PURE__*/React.createElement(Screen, null, /*#__PURE__*/React.createElement(StatusBar, null), /*#__PURE__*/React.createElement(ScreenBody, {
    style: {
      gap: "10px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "18px",
      padding: "12px 0 20px"
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: "Arthur Pendragon",
    size: 88
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "26px",
      fontWeight: "var(--fw-extrabold)",
      lineHeight: 1.15
    }
  }, "Arthur Pendragon"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "16px",
      color: "var(--text-secondary)",
      marginTop: "2px"
    }
  }, "arthur@gpsscooter.app"))), /*#__PURE__*/React.createElement(SectionLabel, null, "Meu ve\xEDculo"), /*#__PURE__*/React.createElement(SettingsRow, {
    label: "Ninebot Max G30",
    icon: "bike",
    control: "action",
    action: "Editar",
    onClick: function () {}
  }), /*#__PURE__*/React.createElement(SectionLabel, {
    style: {
      marginTop: "14px"
    }
  }, "Prefer\xEAncias de rota"), /*#__PURE__*/React.createElement(SettingsRow, {
    label: "Evitar vias r\xE1pidas",
    control: "toggle",
    checked: avoid,
    onChange: setAvoid
  }), /*#__PURE__*/React.createElement(SettingsRow, {
    label: "Preferir ciclovias",
    control: "toggle",
    checked: lanes,
    onChange: setLanes
  }), /*#__PURE__*/React.createElement(SettingsRow, {
    label: "Evitar subidas/morros",
    control: "toggle",
    checked: hills,
    onChange: setHills
  }), /*#__PURE__*/React.createElement(SectionLabel, {
    style: {
      marginTop: "14px"
    }
  }, "Apar\xEAncia & unidades"), /*#__PURE__*/React.createElement(SettingsRow, {
    label: "Tema da Apar\xEAncia",
    control: "value",
    value: "Escuro"
  }), /*#__PURE__*/React.createElement(SettingsRow, {
    label: "Unidades m\xE9tricas",
    control: "value",
    value: "Kil\xF4metros (km)"
  }), /*#__PURE__*/React.createElement(SettingsRow, {
    label: "Sair da Conta",
    tone: "danger",
    icon: "log-out",
    iconColor: "var(--accent-danger)",
    onClick: onBack,
    style: {
      marginTop: "18px"
    }
  })), /*#__PURE__*/React.createElement(HomeIndicator, null));
}
Object.assign(window, {
  TripDetailScreen,
  ProfileScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/scooter-app/DetailScreens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/scooter-app/ExploreScreen.jsx
try { (() => {
const {
  StatusBar,
  HomeIndicator,
  TabBar,
  MapCanvas,
  LocationPuck,
  RouteSearchField,
  VehicleStatusBar
} = window.GPSScooterDesignSystem_7b8022;
const TABS = [{
  id: "explore",
  label: "Explorar",
  icon: "map"
}, {
  id: "saved",
  label: "Salvos",
  icon: "star"
}, {
  id: "activity",
  label: "Atividade",
  icon: "clock"
}];
function Screen({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      display: "flex",
      flexDirection: "column",
      background: "var(--bg-app)",
      ...style
    }
  }, children);
}
function ScreenBody({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minHeight: 0,
      overflowY: "auto",
      padding: "0 var(--screen-gutter)",
      display: "flex",
      flexDirection: "column",
      ...style
    }
  }, children);
}
function ExploreScreen({
  tab,
  onTab,
  onSearch,
  onProfile
}) {
  return /*#__PURE__*/React.createElement(Screen, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0
    }
  }, /*#__PURE__*/React.createElement(MapCanvas, null, /*#__PURE__*/React.createElement(LocationPuck, {
    style: {
      position: "absolute",
      left: "36%",
      top: "48%"
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      height: "100%"
    }
  }, /*#__PURE__*/React.createElement(StatusBar, null), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 var(--screen-gutter)"
    }
  }, /*#__PURE__*/React.createElement(RouteSearchField, {
    origin: "Sua localiza\xE7\xE3o",
    destination: "Para onde?",
    onPress: onSearch,
    onSearch: onSearch,
    avatarSrc: null,
    style: {
      cursor: "pointer"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    },
    onClick: onProfile
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 var(--screen-gutter)",
      display: "flex",
      flexDirection: "column",
      gap: "12px"
    }
  }, /*#__PURE__*/React.createElement(VehicleStatusBar, {
    model: "Ninebot Max G30",
    battery: "84%",
    range: "38 km rest\xE1veis"
  }), /*#__PURE__*/React.createElement(TabBar, {
    items: TABS,
    active: tab,
    onChange: onTab
  })), /*#__PURE__*/React.createElement(HomeIndicator, null)));
}
Object.assign(window, {
  Screen,
  ScreenBody,
  TABS,
  ExploreScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/scooter-app/ExploreScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/scooter-app/ListScreens.jsx
try { (() => {
const {
  StatusBar,
  HomeIndicator,
  NavHeader,
  Button,
  SectionLabel,
  ListRow,
  Card,
  Icon,
  TabBar
} = window.GPSScooterDesignSystem_7b8022;
const FAVOURITES = [{
  title: "Sujinho Hamburgueria",
  subtitle: "R. Augusta, 1005 - Consolação"
}, {
  title: "Parque do Ibirapuera",
  subtitle: "Av. Pedro Álvares Cabral"
}, {
  title: "Livraria Cultura",
  subtitle: "Conjunto Nacional, Av. Paulista"
}];
function Shortcut({
  icon,
  label,
  value
}) {
  return /*#__PURE__*/React.createElement(Card, {
    style: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      gap: "12px",
      padding: "16px 14px"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 26,
    color: "var(--accent-primary)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "17px",
      fontWeight: "var(--fw-bold)"
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "14px",
      color: "var(--text-secondary)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, value)));
}
function SavedScreen({
  tab,
  onTab,
  onPick
}) {
  return /*#__PURE__*/React.createElement(Screen, null, /*#__PURE__*/React.createElement(StatusBar, null), /*#__PURE__*/React.createElement(ScreenBody, {
    style: {
      gap: "12px"
    }
  }, /*#__PURE__*/React.createElement(NavHeader, {
    title: "Salvos",
    action: /*#__PURE__*/React.createElement(Button, {
      variant: "quiet",
      size: "sm",
      style: {
        width: "auto"
      }
    }, "+ Adicionar"),
    style: {
      marginBottom: "8px"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "12px"
    }
  }, /*#__PURE__*/React.createElement(Shortcut, {
    icon: "house",
    label: "Casa",
    value: "Definido: R. Pamplona"
  }), /*#__PURE__*/React.createElement(Shortcut, {
    icon: "briefcase",
    label: "Trabalho",
    value: "Definir endere\xE7o"
  })), /*#__PURE__*/React.createElement(SectionLabel, {
    style: {
      marginTop: "12px"
    }
  }, "Locais favoritos"), FAVOURITES.map(function (p) {
    return /*#__PURE__*/React.createElement(ListRow, {
      key: p.title,
      icon: "star",
      tone: "warn",
      title: p.title,
      subtitle: p.subtitle,
      chevron: true,
      onClick: onPick
    });
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 var(--screen-gutter)"
    }
  }, /*#__PURE__*/React.createElement(TabBar, {
    items: TABS,
    active: tab,
    onChange: onTab
  })), /*#__PURE__*/React.createElement(HomeIndicator, null));
}
const RIDES = [{
  group: "Hoje",
  items: [{
    title: "R. Pamplona → Augusta",
    subtitle: "1.8 km  •  8 min",
    tone: "go"
  }]
}, {
  group: "Ontem",
  items: [{
    title: "Ibirapuera → Paulista",
    subtitle: "4.2 km  •  18 min",
    tone: "go"
  }]
}, {
  group: "Esta semana",
  items: [{
    title: "Consolação → Vila Madalena",
    subtitle: "5.1 km  •  24 min",
    tone: "neutral"
  }, {
    title: "Pinheiros → Faria Lima",
    subtitle: "2.3 km  •  11 min",
    tone: "neutral"
  }]
}];
function ActivityScreen({
  tab,
  onTab,
  onPick
}) {
  return /*#__PURE__*/React.createElement(Screen, null, /*#__PURE__*/React.createElement(StatusBar, null), /*#__PURE__*/React.createElement(ScreenBody, {
    style: {
      gap: "8px"
    }
  }, /*#__PURE__*/React.createElement(NavHeader, {
    title: "Atividade",
    style: {
      marginBottom: "4px"
    }
  }), RIDES.map(function (g) {
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: g.group
    }, /*#__PURE__*/React.createElement(SectionLabel, {
      style: {
        marginTop: "12px",
        marginBottom: "4px"
      }
    }, g.group), g.items.map(function (r) {
      return /*#__PURE__*/React.createElement(ListRow, {
        key: r.title,
        icon: "route",
        tone: r.tone,
        title: r.title,
        subtitle: r.subtitle,
        chevron: true,
        onClick: onPick
      });
    }));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 var(--screen-gutter)"
    }
  }, /*#__PURE__*/React.createElement(TabBar, {
    items: TABS,
    active: tab,
    onChange: onTab
  })), /*#__PURE__*/React.createElement(HomeIndicator, null));
}
Object.assign(window, {
  SavedScreen,
  ActivityScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/scooter-app/ListScreens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/scooter-app/RouteScreens.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  StatusBar,
  MapCanvas,
  LocationPuck,
  BottomSheet,
  SectionLabel,
  RouteOptionCard,
  Button,
  Icon,
  GuidanceBanner,
  StatPill,
  NavStatsBar
} = window.GPSScooterDesignSystem_7b8022;
const OPTIONS = [{
  kind: "recommended",
  tagLabel: "Recomendada",
  distance: "1.8 km",
  description: "Ciclovias e vias calmas e residenciais",
  duration: "8 min"
}, {
  kind: "alternative",
  tagLabel: "Alternativa",
  distance: "2.1 km",
  description: "Tráfego moderado, trecho sem ciclovia",
  duration: "11 min"
}, {
  kind: "fast",
  tagLabel: "Muito rápida",
  distance: "1.4 km",
  description: "Via rápida, não recomendada para scooters",
  duration: "5 min"
}];
const PREVIEW_ROUTES = [{
  d: "M60 840 L360 620 L640 890",
  color: "var(--route-recommended)",
  width: 16
}, {
  d: "M130 1270 L310 880",
  color: "var(--route-caution)",
  width: 16,
  dashed: true
}, {
  d: "M50 560 L260 545",
  color: "var(--route-hazard)",
  width: 14,
  dashed: true
}];
function RouteOptionsScreen({
  onStart
}) {
  const [sel, setSel] = React.useState(0);
  return /*#__PURE__*/React.createElement(Screen, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0
    }
  }, /*#__PURE__*/React.createElement(MapCanvas, {
    routes: PREVIEW_ROUTES
  }, /*#__PURE__*/React.createElement(LocationPuck, {
    style: {
      position: "absolute",
      left: "33%",
      top: "44%"
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      height: "100%"
    }
  }, /*#__PURE__*/React.createElement(StatusBar, null), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(BottomSheet, null, /*#__PURE__*/React.createElement(SectionLabel, {
    style: {
      marginBottom: "12px"
    }
  }, "Op\xE7\xF5es de rota"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "12px"
    }
  }, OPTIONS.map(function (o, i) {
    return /*#__PURE__*/React.createElement(RouteOptionCard, _extends({
      key: o.tagLabel
    }, o, {
      selected: sel === i,
      onClick: function () {
        setSel(i);
      }
    }));
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "go",
    size: "lg",
    style: {
      marginTop: "20px"
    },
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "navigation",
      size: 22
    }),
    onClick: onStart
  }, "Iniciar Navega\xE7\xE3o"))));
}
function NavigationScreen({
  onStop
}) {
  return /*#__PURE__*/React.createElement(Screen, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0
    }
  }, /*#__PURE__*/React.createElement(MapCanvas, {
    routes: [{
      d: "M600 300 L600 1750",
      color: "var(--route-active)",
      width: 16,
      glow: true
    }, {
      d: "M760 280 L1020 600",
      color: "var(--route-active)",
      width: 16
    }]
  }, /*#__PURE__*/React.createElement(LocationPuck, {
    variant: "navigating",
    style: {
      position: "absolute",
      left: "52%",
      top: "54%",
      transform: "translate(-50%,-50%)"
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      height: "100%"
    }
  }, /*#__PURE__*/React.createElement(StatusBar, null), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 var(--screen-gutter)"
    }
  }, /*#__PURE__*/React.createElement(GuidanceBanner, {
    maneuver: "arrow-left",
    instruction: "Vire \xE0 esquerda",
    street: "na R. Augusta em",
    distance: "350m",
    onDismiss: onStop
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 var(--screen-gutter)",
      display: "flex",
      justifyContent: "space-between",
      marginBottom: "12px"
    }
  }, /*#__PURE__*/React.createElement(StatPill, {
    label: "Velocidade",
    value: "22 km/h"
  }), /*#__PURE__*/React.createElement(StatPill, {
    label: "Bateria",
    value: "82%",
    tone: "go",
    align: "right"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 var(--screen-gutter)"
    }
  }, /*#__PURE__*/React.createElement(NavStatsBar, {
    stats: [{
      value: "10:04",
      label: "Hora de chegada",
      tone: "accent"
    }, {
      value: "6 min",
      label: "Tempo restável"
    }, {
      value: "1.3 km",
      label: "Distância restante"
    }]
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      height: "var(--safe-bottom)"
    }
  })));
}
Object.assign(window, {
  RouteOptionsScreen,
  NavigationScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/scooter-app/RouteScreens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/scooter-app/SearchScreen.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  StatusBar,
  HomeIndicator,
  SearchField,
  Chip,
  SectionLabel,
  ListRow,
  SkeletonRow
} = window.GPSScooterDesignSystem_7b8022;
const RESULTS = [{
  icon: "map-pin",
  title: "Av. Paulista, 1000",
  subtitle: "Bela Vista, São Paulo - SP",
  trailing: "1.2 km"
}, {
  icon: "map-pin",
  title: "Shopping Cidade São Paulo",
  subtitle: "Av. Paulista, 1230 - São Paulo",
  trailing: "1.5 km"
}, {
  icon: "clock",
  title: "Parque do Ibirapuera",
  subtitle: "Av. Pedro Álvares Cabral - SP",
  trailing: "4.2 km"
}];
function SearchScreen({
  onBack,
  onPick
}) {
  const [q, setQ] = React.useState("Av. Paulista");
  const [chip, setChip] = React.useState(null);
  return /*#__PURE__*/React.createElement(Screen, null, /*#__PURE__*/React.createElement(StatusBar, null), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface-sunken)",
      padding: "4px var(--screen-gutter) 16px",
      display: "flex",
      flexDirection: "column",
      gap: "16px"
    }
  }, /*#__PURE__*/React.createElement(SearchField, {
    value: q,
    focused: true,
    onChange: function (e) {
      setQ(e.target.value);
    },
    onClear: function () {
      setQ("");
    },
    onBack: onBack
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "12px",
      overflowX: "auto"
    }
  }, ["Restaurantes", "Postos", "Estacionar"].map(function (c) {
    return /*#__PURE__*/React.createElement(Chip, {
      key: c,
      selected: chip === c,
      onClick: function () {
        setChip(chip === c ? null : c);
      }
    }, c);
  }))), /*#__PURE__*/React.createElement(ScreenBody, {
    style: {
      paddingTop: "20px",
      gap: "0"
    }
  }, /*#__PURE__*/React.createElement(SectionLabel, {
    style: {
      marginBottom: "4px"
    }
  }, "Resultados"), RESULTS.map(function (r) {
    return /*#__PURE__*/React.createElement(ListRow, _extends({
      key: r.title,
      divider: true,
      iconShape: "circle",
      tone: "accent"
    }, r, {
      onClick: function () {
        onPick(r);
      }
    }));
  }), /*#__PURE__*/React.createElement(SkeletonRow, null)), /*#__PURE__*/React.createElement(HomeIndicator, null));
}
Object.assign(window, {
  SearchScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/scooter-app/SearchScreen.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Chip = __ds_scope.Chip;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.SectionLabel = __ds_scope.SectionLabel;

__ds_ns.StatTile = __ds_scope.StatTile;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.ListRow = __ds_scope.ListRow;

__ds_ns.SkeletonRow = __ds_scope.SkeletonRow;

__ds_ns.RouteSearchField = __ds_scope.RouteSearchField;

__ds_ns.SearchField = __ds_scope.SearchField;

__ds_ns.SettingsRow = __ds_scope.SettingsRow;

__ds_ns.Toggle = __ds_scope.Toggle;

__ds_ns.BottomSheet = __ds_scope.BottomSheet;

__ds_ns.LocationPuck = __ds_scope.LocationPuck;

__ds_ns.MapCanvas = __ds_scope.MapCanvas;

__ds_ns.NavStatsBar = __ds_scope.NavStatsBar;

__ds_ns.RouteOptionCard = __ds_scope.RouteOptionCard;

__ds_ns.StatPill = __ds_scope.StatPill;

__ds_ns.VehicleStatusBar = __ds_scope.VehicleStatusBar;

__ds_ns.GuidanceBanner = __ds_scope.GuidanceBanner;

__ds_ns.NavHeader = __ds_scope.NavHeader;

__ds_ns.StatusBar = __ds_scope.StatusBar;

__ds_ns.HomeIndicator = __ds_scope.HomeIndicator;

__ds_ns.TabBar = __ds_scope.TabBar;

})();
