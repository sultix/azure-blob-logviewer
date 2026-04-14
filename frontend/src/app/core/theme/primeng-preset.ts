import { definePreset } from "@primeuix/themes";
import Aura from "@primeuix/themes/aura";

/**
 * PrimeNG theme preset aligned with the Tailwind "obsidian console" design tokens.
 *
 * Surface / color values mirror tailwind.config.js so that PrimeNG components
 * blend seamlessly with the rest of the UI.
 */
export const ObsidianConsolePreset = definePreset(Aura, {
  components: {
    datepicker: {
      panel: {
        padding: "0.625rem",
      },
      header: {
        padding: "0 0 0.375rem 0",
      },
      title: {
        gap: "0.375rem",
      },
      dayView: {
        margin: "0.375rem 0 0 0",
      },
      weekDay: {
        padding: "0.125rem",
      },
      date: {
        width: "1.75rem",
        height: "1.75rem",
        padding: "0.125rem",
      },
      monthView: {
        margin: "0.375rem 0 0 0",
      },
      month: {
        padding: "0.25rem",
      },
      yearView: {
        margin: "0.375rem 0 0 0",
      },
      year: {
        padding: "0.25rem",
      },
      colorScheme: {
        dark: {
          inputIcon: {
            color: "#88929b",
          },
          panel: {
            background: "#171f33",
            borderColor: "#3e4850",
            color: "#dae2fd",
          },
          header: {
            background: "#171f33",
            borderColor: "#3e4850",
            color: "#dae2fd",
          },
          selectMonth: {
            hoverBackground: "#222a3d",
            color: "#dae2fd",
            hoverColor: "#dae2fd",
          },
          selectYear: {
            hoverBackground: "#222a3d",
            color: "#dae2fd",
            hoverColor: "#dae2fd",
          },
          weekDay: {
            color: "#88929b",
          },
          date: {
            hoverBackground: "#222a3d",
            hoverColor: "#dae2fd",
            selectedBackground: "{primary.color}",
            selectedColor: "{primary.contrast.color}",
            rangeSelectedBackground:
              "color-mix(in srgb, #89ceff, transparent 84%)",
            rangeSelectedColor: "#dae2fd",
          },
          today: {
            background: "#222a3d",
            color: "#89ceff",
          },
        },
      },
    },
    button: {
      colorScheme: {
        dark: {
          root: {
            secondary: {
              background: "#2d3449",
              hoverBackground: "#3e4850",
              activeBackground: "#5d6775",
              borderColor: "#2d3449",
              hoverBorderColor: "#3e4850",
              activeBorderColor: "#5d6775",
              color: "#bec8d2",
              hoverColor: "#dae2fd",
              activeColor: "#dae2fd",
            },
          },
          text: {
            secondary: {
              hoverBackground: "rgba(218, 226, 253, 0.08)",
              activeBackground: "rgba(218, 226, 253, 0.16)",
              color: "#bec8d2",
            },
            plain: {
              hoverBackground: "rgba(218, 226, 253, 0.08)",
              activeBackground: "rgba(218, 226, 253, 0.16)",
              color: "#bec8d2",
            },
          },
          outlined: {
            secondary: {
              hoverBackground: "rgba(218, 226, 253, 0.04)",
              activeBackground: "rgba(218, 226, 253, 0.16)",
              borderColor: "#3e4850",
              color: "#bec8d2",
            },
          },
        },
      },
    },
  },
  primitive: {
    borderRadius: {
      none: "0",
      xs: "2px",
      sm: "4px",
      md: "6px",
      lg: "8px",
      xl: "12px",
    },
  },
  semantic: {
    transitionDuration: "0.2s",
    focusRing: {
      width: "2px",
      style: "solid",
      color: "{primary.color}",
      offset: "1px",
      shadow: "none",
    },
    primary: {
      50: "#e0f2fe",
      100: "#bae6fd",
      200: "#89ceff",
      300: "#5ebdff",
      400: "#38bdf8",
      500: "#0ea5e9",
      600: "#0284c7",
      700: "#0369a1",
      800: "#075985",
      900: "#0c4a6e",
      950: "#00344d",
    },
    formField: {
      paddingX: "0.6875rem",
      paddingY: "0.6875rem",
      sm: {
        fontSize: "0.8125rem",
        paddingX: "0.5625rem",
        paddingY: "0.5625rem",
      },
      lg: {
        fontSize: "1rem",
        paddingX: "0.75rem",
        paddingY: "0.75rem",
      },
      borderRadius: "{border.radius.lg}",
    },
    overlay: {
      modal: {
        borderRadius: "{border.radius.xl}",
        padding: "1.75rem",
        shadow: "0 20px 50px rgba(0, 0, 0, 0.3)",
      },
      select: {
        borderRadius: "{border.radius.lg}",
        shadow: "0 20px 50px rgba(0, 0, 0, 0.3)",
      },
      popover: {
        borderRadius: "{border.radius.lg}",
        shadow: "0 20px 50px rgba(0, 0, 0, 0.3)",
      },
    },
    colorScheme: {
      light: {
        /* App is dark-only – provide passable light fallbacks just in case */
        primary: {
          color: "#0ea5e9",
          contrastColor: "#ffffff",
          hoverColor: "#0284c7",
          activeColor: "#0369a1",
        },
      },
      dark: {
        /* PrimeNG dark mode convention: low numbers = light, high numbers = dark.
           Mapped from Tailwind obsidian console tokens. */
        surface: {
          0: "#dae2fd", // on-surface (text)
          50: "#c4cde0", // between on-surface and on-surface-variant
          100: "#bec8d2", // on-surface-variant
          200: "#a3adb8", // between on-surface-variant and outline
          300: "#88929b", // outline (muted icons/text)
          400: "#88929b", // outline (secondary button text, close icon)
          500: "#5d6775", // between outline and outline-variant
          600: "#3e4850", // outline-variant (borders)
          700: "#2d3449", // surface-container-highest
          800: "#222a3d", // surface-container-high
          900: "#171f33", // surface-container
          950: "#060e20", // surface-container-lowest
        },
        primary: {
          color: "#89ceff",
          contrastColor: "#00344d",
          hoverColor: "#bae6fd",
          activeColor: "#e0f2fe",
        },
        highlight: {
          background: "color-mix(in srgb, #89ceff, transparent 84%)",
          focusBackground: "color-mix(in srgb, #89ceff, transparent 76%)",
          color: "rgba(218, 226, 253, 0.87)",
          focusColor: "rgba(218, 226, 253, 0.87)",
        },
        mask: {
          background: "rgba(6, 14, 32, 0.7)",
          color: "#dae2fd",
        },
        formField: {
          background: "#060e20",
          disabledBackground: "#222a3d",
          filledBackground: "#131b2e",
          filledHoverBackground: "#171f33",
          filledFocusBackground: "#171f33",
          borderColor: "#3e4850",
          hoverBorderColor: "#88929b",
          focusBorderColor: "{primary.color}",
          invalidBorderColor: "#ffb4ab",
          color: "#dae2fd",
          disabledColor: "#88929b",
          placeholderColor: "#88929b",
          invalidPlaceholderColor: "#ffb4ab",
          floatLabelColor: "#88929b",
          floatLabelFocusColor: "{primary.color}",
          floatLabelActiveColor: "#88929b",
          floatLabelInvalidColor: "#ffb4ab",
          iconColor: "#88929b",
          shadow: "none",
        },
        text: {
          color: "#dae2fd",
          hoverColor: "#dae2fd",
          mutedColor: "#bec8d2",
          hoverMutedColor: "#dae2fd",
        },
        content: {
          background: "#171f33",
          hoverBackground: "#222a3d",
          borderColor: "#3e4850",
          color: "#dae2fd",
          hoverColor: "#dae2fd",
        },
        overlay: {
          select: {
            background: "#171f33",
            borderColor: "#3e4850",
            color: "#dae2fd",
          },
          popover: {
            background: "#171f33",
            borderColor: "#3e4850",
            color: "#dae2fd",
          },
          modal: {
            background: "#222a3d",
            borderColor: "#3e4850",
            color: "#dae2fd",
          },
        },
        list: {
          option: {
            focusBackground: "#222a3d",
            selectedBackground: "color-mix(in srgb, #89ceff, transparent 84%)",
            selectedFocusBackground:
              "color-mix(in srgb, #89ceff, transparent 76%)",
            color: "#dae2fd",
            focusColor: "#dae2fd",
            selectedColor: "rgba(218, 226, 253, 0.87)",
            selectedFocusColor: "rgba(218, 226, 253, 0.87)",
            icon: {
              color: "#88929b",
              focusColor: "#bec8d2",
            },
          },
          optionGroup: {
            background: "transparent",
            color: "#bec8d2",
          },
        },
        navigation: {
          item: {
            focusBackground: "#222a3d",
            activeBackground: "#222a3d",
            color: "#dae2fd",
            focusColor: "#dae2fd",
            activeColor: "#dae2fd",
            icon: {
              color: "#88929b",
              focusColor: "#bec8d2",
              activeColor: "#bec8d2",
            },
          },
          submenuLabel: {
            background: "transparent",
            color: "#bec8d2",
          },
          submenuIcon: {
            color: "#88929b",
            focusColor: "#bec8d2",
            activeColor: "#bec8d2",
          },
        },
      },
    },
  },
  css: `
    .p-component {
      font-size: 0.775rem;
    }

    .p-select .p-select-label {
      font-size: 0.75rem;
    }

    .p-datepicker {
      font-size: 0.725rem;
    }

    .p-datepicker-calendar th {
      font-size: 0.6875rem;
      letter-spacing: 0.01em;
    }
  `,
});
