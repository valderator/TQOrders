import { useWindowDimensions } from 'react-native';

export function useLayoutInfo() {
  const { width, height } = useWindowDimensions();
  return {
    width,
    height,
    isWide: width >= 900,
    isTablet: width >= 640,
    isCompact: width < 420,
  };
}
