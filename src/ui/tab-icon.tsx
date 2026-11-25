import Svg, { Circle, Path, Rect } from 'react-native-svg';

export function TabIcon({ name, color }: { name: 'today' | 'route' | 'board' | 'jobs' | 'account'; color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" accessibilityElementsHidden>
      {name === 'today' ? <Rect x="3" y="4" width="16" height="14" rx="2" stroke={color} fill="none" strokeWidth={1.6} /> : null}
      {name === 'today' ? <Path d="M3 8 H19 M7 2 V6 M15 2 V6" stroke={color} strokeWidth={1.6} /> : null}
      {name === 'route' ? <Circle cx="6" cy="5" r="2" fill={color} /> : null}
      {name === 'route' ? <Circle cx="16" cy="17" r="2" fill={color} /> : null}
      {name === 'route' ? <Path d="M7 7 C12 7 10 15 15 15" stroke={color} fill="none" strokeWidth={1.6} /> : null}
      {name === 'board' ? <Circle cx="7" cy="8" r="2.2" fill={color} /> : null}
      {name === 'board' ? <Circle cx="15" cy="8" r="2.2" fill={color} /> : null}
      {name === 'board' ? <Path d="M3 16 C4 13 6 12 7 12 C8 12 10 13 11 16 M11 16 C12 13 14 12 15 12 C16 12 18 13 19 16" stroke={color} fill="none" strokeWidth={1.6} /> : null}
      {name === 'jobs' ? <Path d="M5 4 H17 V18 H5 Z M8 8 H14 M8 12 H14" stroke={color} fill="none" strokeWidth={1.6} /> : null}
      {name === 'account' ? <Circle cx="11" cy="8" r="3" stroke={color} fill="none" strokeWidth={1.6} /> : null}
      {name === 'account' ? <Path d="M4 18 C5 14 8 13 11 13 C14 13 17 14 18 18" stroke={color} fill="none" strokeWidth={1.6} /> : null}
    </Svg>
  );
}
