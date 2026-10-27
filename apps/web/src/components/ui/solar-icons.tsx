import React from 'react'

type Icon = React.ComponentType<any>
import {
  RulerIcon,
  BoxIcon,
  LayersIcon,
  TagIcon,
  ShopIcon,
  ShieldCheckIcon,
  PaletteIcon,
  ScaleIcon,
} from '@solar-icons/react/linear'

export interface SolarIconProps extends Omit<React.SVGProps<SVGSVGElement>, 'color'> {
  className?: string
  size?: number | string
  color?: string
  strokeWidth?: number | string
}

function createSolarIcon(SolarComponent: Icon, defaultSize = 20) {
  const IconWrapper = React.forwardRef<SVGSVGElement, SolarIconProps>(
    ({ size = defaultSize, className, ...props }, ref) => {
      return <SolarComponent ref={ref} size={size} className={className} {...props} />
    }
  )
  IconWrapper.displayName = SolarComponent.displayName || 'SolarIconWrapper'
  return IconWrapper
}

/** Solar Linear Ruler & Measure Icon from @solar-icons/react */
export const SolarRulerIcon = createSolarIcon(RulerIcon)

/** Solar Linear Box Packaging Icon from @solar-icons/react */
export const SolarBoxIcon = createSolarIcon(BoxIcon)

/** Solar Linear Layers Icon from @solar-icons/react */
export const SolarLayersIcon = createSolarIcon(LayersIcon)

/** Solar Linear Tag Icon from @solar-icons/react */
export const SolarTagIcon = createSolarIcon(TagIcon)

/** Solar Linear Shop Icon from @solar-icons/react */
export const SolarShopIcon = createSolarIcon(ShopIcon)

/** Solar Linear Shield Check Icon from @solar-icons/react */
export const SolarShieldCheckIcon = createSolarIcon(ShieldCheckIcon)

/** Solar Linear Palette Icon from @solar-icons/react */
export const SolarPaletteIcon = createSolarIcon(PaletteIcon)

/** Solar Linear Scale Icon from @solar-icons/react */
export const SolarScaleIcon = createSolarIcon(ScaleIcon)
