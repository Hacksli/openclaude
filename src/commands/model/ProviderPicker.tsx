import * as React from 'react'
import { Box, Text } from '../../ink.js'
import { Select } from '../../components/CustomSelect/index.js'
import { Pane } from '../../components/design-system/Pane.js'
import {
  getProviderProfiles,
  getActiveProviderProfile,
  setActiveProviderProfile,
  applyProviderProfileToProcessEnv,
} from '../../utils/providerProfiles.js'
import type { ProviderProfile } from '../../utils/config.js'

type ProviderOption = {
  label: string
  value: string
  description: string
  active: boolean
}

function buildProviderOptions(): ProviderOption[] {
  const profiles = getProviderProfiles()
  const activeId = getActiveProviderProfile()?.id

  if (profiles.length === 0) {
    return [
      {
        label: 'Anthropic',
        value: 'anthropic-default',
        description: 'Default Anthropic provider (api.anthropic.com)',
        active: true,
      },
    ]
  }

  return profiles.map(p => ({
    label: `${p.name}`,
    value: p.id,
    description: `${p.provider === 'anthropic' ? 'Anthropic' : 'OpenAI-compatible'} · ${p.baseUrl.replace(/https?:\/\//, '').replace(/\/v1$/, '')} · ${p.model}`,
    active: p.id === activeId,
  }))
}

export function ProviderPicker({
  onSelect,
  onCancel,
}: {
  onSelect: (profile: ProviderProfile) => void
  onCancel: () => void
}): React.ReactElement {
  const options = buildProviderOptions()

  const activeIdx = options.findIndex(o => o.active)

  return (
    <Pane color="permission">
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="claude">Select Provider</Text>
        <Text dimColor>Switch API provider. Applies to this session only.</Text>
      </Box>
      <Select
        options={options.map(o => ({
          label: o.active ? `${o.label} (active)` : o.label,
          value: o.value,
          description: o.description,
        }))}
        defaultValue={
          options[activeIdx >= 0 ? activeIdx : 0]?.value ?? options[0]?.value
        }
        visibleOptionCount={Math.min(8, options.length)}
        onChange={(value: string) => {
          if (value === 'anthropic-default') {
            // Create a temporary default profile for default anthropic
            const defaultProfile: ProviderProfile = {
              id: 'anthropic-default',
              name: 'Anthropic',
              provider: 'anthropic',
              baseUrl: 'https://api.anthropic.com',
              model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
            }
            onSelect(defaultProfile)
            return
          }
          const profile = getProviderProfiles().find(p => p.id === value)
          if (profile) {
            setActiveProviderProfile(profile.id)
            onSelect(profile)
          }
        }}
        onCancel={onCancel}
      />
    </Pane>
  )
}
