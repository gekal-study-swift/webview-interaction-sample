'use client';

import Avatar from '@mui/material/Avatar';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import type { ReactNode } from 'react';

interface SectionCardProps {
  icon: ReactNode;
  title: string;
  subheader?: string;
  /** タイトル横に表示する方向バッジ（`JS → Native` など）。 */
  badge?: string;
  badgeColor?: 'primary' | 'secondary' | 'default';
  action?: ReactNode;
  children: ReactNode;
}

export function SectionCard({
  icon,
  title,
  subheader,
  badge,
  badgeColor = 'default',
  action,
  children,
}: SectionCardProps) {
  return (
    <Card>
      <CardHeader
        avatar={
          <Avatar variant="rounded" sx={{ width: 36, height: 36, bgcolor: 'action.hover', color: 'primary.main' }}>
            {icon}
          </Avatar>
        }
        title={
          <Stack direction="row" spacing={0.75} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <span>{title}</span>
            {badge && (
              <Chip
                size="small"
                label={badge}
                color={badgeColor}
                variant="outlined"
                sx={{ height: 20, fontSize: 11 }}
              />
            )}
          </Stack>
        }
        subheader={subheader}
        action={action}
        sx={{
          pb: 0,
          alignItems: 'flex-start',
          '& .MuiCardHeader-action': { alignSelf: 'center', mt: 0, mr: 0, flexShrink: 0 },
          '& .MuiCardHeader-content': { minWidth: 0 },
        }}
      />
      <CardContent sx={{ pt: 2 }}>{children}</CardContent>
    </Card>
  );
}
