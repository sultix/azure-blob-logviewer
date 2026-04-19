import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

const lightPalette = {
  surface: {
    0: '#0f172a',
    50: '#334155',
    100: '#475569',
    200: '#64748b',
    300: '#94a3b8',
    400: '#cbd5e1',
    500: '#d6dfea',
    600: '#e1e8f1',
    700: '#eaeff5',
    800: '#f3f7fc',
    900: '#ffffff',
    950: '#ffffff',
  },
  primary: {
    color: '#0ea5e9',
    contrastColor: '#ffffff',
    hoverColor: '#0284c7',
    activeColor: '#0369a1',
  },
  highlight: {
    background: 'color-mix(in srgb, #0ea5e9, transparent 88%)',
    focusBackground: 'color-mix(in srgb, #0ea5e9, transparent 80%)',
    color: '#0f172a',
    focusColor: '#0f172a',
  },
  mask: {
    background: 'rgba(15, 23, 42, 0.24)',
    color: '#0f172a',
  },
  formField: {
    background: '#ffffff',
    disabledBackground: '#e1e8f1',
    filledBackground: '#f3f7fc',
    filledHoverBackground: '#eaeff5',
    filledFocusBackground: '#ffffff',
    borderColor: '#cbd5e1',
    hoverBorderColor: '#94a3b8',
    focusBorderColor: '#0ea5e9',
    invalidBorderColor: '#b91c1c',
    color: '#0f172a',
    disabledColor: '#64748b',
    placeholderColor: '#64748b',
    invalidPlaceholderColor: '#b91c1c',
    floatLabelColor: '#64748b',
    floatLabelFocusColor: '#0ea5e9',
    floatLabelActiveColor: '#64748b',
    floatLabelInvalidColor: '#b91c1c',
    iconColor: '#64748b',
    shadow: 'none',
  },
  text: {
    color: '#0f172a',
    hoverColor: '#0f172a',
    mutedColor: '#475569',
    hoverMutedColor: '#0f172a',
  },
  content: {
    background: '#eaeff5',
    hoverBackground: '#e1e8f1',
    borderColor: '#dbe3ee',
    color: '#0f172a',
    hoverColor: '#0f172a',
  },
  overlay: {
    select: {
      background: '#ffffff',
      borderColor: '#dbe3ee',
      color: '#0f172a',
    },
    popover: {
      background: '#ffffff',
      borderColor: '#dbe3ee',
      color: '#0f172a',
    },
    modal: {
      background: '#ffffff',
      borderColor: '#dbe3ee',
      color: '#0f172a',
    },
  },
  list: {
    option: {
      focusBackground: '#e1e8f1',
      selectedBackground: 'color-mix(in srgb, #0ea5e9, transparent 88%)',
      selectedFocusBackground: 'color-mix(in srgb, #0ea5e9, transparent 82%)',
      color: '#0f172a',
      focusColor: '#0f172a',
      selectedColor: '#0f172a',
      selectedFocusColor: '#0f172a',
      icon: {
        color: '#64748b',
        focusColor: '#334155',
      },
    },
    optionGroup: {
      background: 'transparent',
      color: '#475569',
    },
  },
  navigation: {
    item: {
      focusBackground: '#e1e8f1',
      activeBackground: '#e1e8f1',
      color: '#0f172a',
      focusColor: '#0f172a',
      activeColor: '#0f172a',
      icon: {
        color: '#64748b',
        focusColor: '#334155',
        activeColor: '#334155',
      },
    },
    submenuLabel: {
      background: 'transparent',
      color: '#475569',
    },
    submenuIcon: {
      color: '#64748b',
      focusColor: '#334155',
      activeColor: '#334155',
    },
  },
} as const;

const darkPalette = {
  surface: {
    0: '#dae2fd',
    50: '#c4cde0',
    100: '#bec8d2',
    200: '#a3adb8',
    300: '#88929b',
    400: '#88929b',
    500: '#5d6775',
    600: '#3e4850',
    700: '#2d3449',
    800: '#222a3d',
    900: '#171f33',
    950: '#060e20',
  },
  primary: {
    color: '#89ceff',
    contrastColor: '#00344d',
    hoverColor: '#bae6fd',
    activeColor: '#e0f2fe',
  },
  highlight: {
    background: 'color-mix(in srgb, #89ceff, transparent 84%)',
    focusBackground: 'color-mix(in srgb, #89ceff, transparent 76%)',
    color: 'rgba(218, 226, 253, 0.87)',
    focusColor: 'rgba(218, 226, 253, 0.87)',
  },
  mask: {
    background: 'rgba(6, 14, 32, 0.7)',
    color: '#dae2fd',
  },
  formField: {
    background: '#060e20',
    disabledBackground: '#222a3d',
    filledBackground: '#131b2e',
    filledHoverBackground: '#171f33',
    filledFocusBackground: '#171f33',
    borderColor: '#3e4850',
    hoverBorderColor: '#88929b',
    focusBorderColor: '#89ceff',
    invalidBorderColor: '#ff8a80',
    color: '#dae2fd',
    disabledColor: '#88929b',
    placeholderColor: '#88929b',
    invalidPlaceholderColor: '#ff8a80',
    floatLabelColor: '#88929b',
    floatLabelFocusColor: '#89ceff',
    floatLabelActiveColor: '#88929b',
    floatLabelInvalidColor: '#ff8a80',
    iconColor: '#88929b',
    shadow: 'none',
  },
  text: {
    color: '#dae2fd',
    hoverColor: '#dae2fd',
    mutedColor: '#bec8d2',
    hoverMutedColor: '#dae2fd',
  },
  content: {
    background: '#171f33',
    hoverBackground: '#222a3d',
    borderColor: '#3e4850',
    color: '#dae2fd',
    hoverColor: '#dae2fd',
  },
  overlay: {
    select: {
      background: '#171f33',
      borderColor: '#3e4850',
      color: '#dae2fd',
    },
    popover: {
      background: '#171f33',
      borderColor: '#3e4850',
      color: '#dae2fd',
    },
    modal: {
      background: '#101c38',
      borderColor: '#122133',
      color: '#dae2fd',
    },
  },
  list: {
    option: {
      focusBackground: '#222a3d',
      selectedBackground: 'color-mix(in srgb, #89ceff, transparent 84%)',
      selectedFocusBackground: 'color-mix(in srgb, #89ceff, transparent 76%)',
      color: '#dae2fd',
      focusColor: '#dae2fd',
      selectedColor: 'rgba(218, 226, 253, 0.87)',
      selectedFocusColor: 'rgba(218, 226, 253, 0.87)',
      icon: {
        color: '#88929b',
        focusColor: '#bec8d2',
      },
    },
    optionGroup: {
      background: 'transparent',
      color: '#bec8d2',
    },
  },
  navigation: {
    item: {
      focusBackground: '#222a3d',
      activeBackground: '#222a3d',
      color: '#dae2fd',
      focusColor: '#dae2fd',
      activeColor: '#dae2fd',
      icon: {
        color: '#88929b',
        focusColor: '#bec8d2',
        activeColor: '#bec8d2',
      },
    },
    submenuLabel: {
      background: 'transparent',
      color: '#bec8d2',
    },
    submenuIcon: {
      color: '#88929b',
      focusColor: '#bec8d2',
      activeColor: '#bec8d2',
    },
  },
} as const;

/**
 * PrimeNG theme preset aligned with the Tailwind app tokens for both light and dark mode.
 */
export const ObsidianConsolePreset = definePreset(Aura, {
  components: {
    datepicker: {
      panel: {
        padding: '0.625rem',
      },
      header: {
        padding: '0 0 0.375rem 0',
      },
      title: {
        gap: '0.375rem',
      },
      dayView: {
        margin: '0.375rem 0 0 0',
      },
      weekDay: {
        padding: '0.125rem',
      },
      date: {
        width: '1.75rem',
        height: '1.75rem',
        padding: '0.125rem',
      },
      monthView: {
        margin: '0.375rem 0 0 0',
      },
      month: {
        padding: '0.25rem',
      },
      yearView: {
        margin: '0.375rem 0 0 0',
      },
      year: {
        padding: '0.25rem',
      },
      colorScheme: {
        light: {
          inputIcon: {
            color: '#64748b',
          },
          panel: {
            background: '#ffffff',
            borderColor: '#dbe3ee',
            color: '#0f172a',
          },
          header: {
            background: '#ffffff',
            borderColor: '#dbe3ee',
            color: '#0f172a',
          },
          selectMonth: {
            hoverBackground: '#e1e8f1',
            color: '#0f172a',
            hoverColor: '#0f172a',
          },
          selectYear: {
            hoverBackground: '#e1e8f1',
            color: '#0f172a',
            hoverColor: '#0f172a',
          },
          weekDay: {
            color: '#64748b',
          },
          date: {
            hoverBackground: '#e1e8f1',
            hoverColor: '#0f172a',
            selectedBackground: '{primary.color}',
            selectedColor: '{primary.contrast.color}',
            rangeSelectedBackground: 'color-mix(in srgb, #0ea5e9, transparent 88%)',
            rangeSelectedColor: '#0f172a',
          },
          today: {
            background: '#e1e8f1',
            color: '#0284c7',
          },
        },
        dark: {
          inputIcon: {
            color: '#88929b',
          },
          panel: {
            background: '#171f33',
            borderColor: '#3e4850',
            color: '#dae2fd',
          },
          header: {
            background: '#171f33',
            borderColor: '#3e4850',
            color: '#dae2fd',
          },
          selectMonth: {
            hoverBackground: '#222a3d',
            color: '#dae2fd',
            hoverColor: '#dae2fd',
          },
          selectYear: {
            hoverBackground: '#222a3d',
            color: '#dae2fd',
            hoverColor: '#dae2fd',
          },
          weekDay: {
            color: '#88929b',
          },
          date: {
            hoverBackground: '#222a3d',
            hoverColor: '#dae2fd',
            selectedBackground: '{primary.color}',
            selectedColor: '{primary.contrast.color}',
            rangeSelectedBackground: 'color-mix(in srgb, #89ceff, transparent 84%)',
            rangeSelectedColor: '#dae2fd',
          },
          today: {
            background: '#222a3d',
            color: '#89ceff',
          },
        },
      },
    },
    button: {
      colorScheme: {
        light: {
          root: {
            secondary: {
              background: '#d6dfea',
              hoverBackground: '#cbd5e1',
              activeBackground: '#b6c3d5',
              borderColor: '#d6dfea',
              hoverBorderColor: '#cbd5e1',
              activeBorderColor: '#b6c3d5',
              color: '#334155',
              hoverColor: '#0f172a',
              activeColor: '#0f172a',
            },
          },
          text: {
            secondary: {
              hoverBackground: 'rgba(15, 23, 42, 0.06)',
              activeBackground: 'rgba(15, 23, 42, 0.12)',
              color: '#475569',
            },
            plain: {
              hoverBackground: 'rgba(15, 23, 42, 0.06)',
              activeBackground: 'rgba(15, 23, 42, 0.12)',
              color: '#475569',
            },
          },
          outlined: {
            secondary: {
              hoverBackground: 'rgba(15, 23, 42, 0.03)',
              activeBackground: 'rgba(15, 23, 42, 0.08)',
              borderColor: '#cbd5e1',
              color: '#475569',
            },
          },
        },
        dark: {
          root: {
            secondary: {
              background: '#2d3449',
              hoverBackground: '#3e4850',
              activeBackground: '#5d6775',
              borderColor: '#2d3449',
              hoverBorderColor: '#3e4850',
              activeBorderColor: '#5d6775',
              color: '#bec8d2',
              hoverColor: '#dae2fd',
              activeColor: '#dae2fd',
            },
          },
          text: {
            secondary: {
              hoverBackground: 'rgba(218, 226, 253, 0.08)',
              activeBackground: 'rgba(218, 226, 253, 0.16)',
              color: '#bec8d2',
            },
            plain: {
              hoverBackground: 'rgba(218, 226, 253, 0.08)',
              activeBackground: 'rgba(218, 226, 253, 0.16)',
              color: '#bec8d2',
            },
          },
          outlined: {
            secondary: {
              hoverBackground: 'rgba(218, 226, 253, 0.04)',
              activeBackground: 'rgba(218, 226, 253, 0.16)',
              borderColor: '#3e4850',
              color: '#bec8d2',
            },
          },
        },
      },
    },
  },
  primitive: {
    borderRadius: {
      none: '0',
      xs: '2px',
      sm: '4px',
      md: '6px',
      lg: '8px',
      xl: '12px',
    },
  },
  semantic: {
    transitionDuration: '0.2s',
    focusRing: {
      width: '2px',
      style: 'solid',
      color: '{primary.color}',
      offset: '1px',
      shadow: 'none',
    },
    primary: {
      50: '#e0f2fe',
      100: '#bae6fd',
      200: '#89ceff',
      300: '#5ebdff',
      400: '#38bdf8',
      500: '#0ea5e9',
      600: '#0284c7',
      700: '#0369a1',
      800: '#075985',
      900: '#0c4a6e',
      950: '#00344d',
    },
    formField: {
      borderRadius: '{border.radius.lg}',
    },
    overlay: {
      modal: {
        borderRadius: '{border.radius.xl}',
        padding: '1.75rem',
        shadow: '0 20px 50px rgba(15, 23, 42, 0.18)',
      },
      select: {
        borderRadius: '{border.radius.lg}',
        shadow: '0 20px 50px rgba(15, 23, 42, 0.18)',
      },
      popover: {
        borderRadius: '{border.radius.lg}',
        shadow: '0 20px 50px rgba(15, 23, 42, 0.18)',
      },
    },
    colorScheme: {
      light: lightPalette,
      dark: darkPalette,
    },
  },
  css: `
    .p-component {
      font-size: 0.775rem;
    }

    .p-select .p-select-label {
      font-size: 0.95rem;
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
