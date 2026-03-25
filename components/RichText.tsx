import { Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, SIZES } from '@/constants/theme';

interface Props {
  text: string;
  style?: any;
  numberOfLines?: number;
}

const URL_REGEX = /https?:\/\/[^\s)]+/g;
const MENTION_REGEX = /@(\w{2,30})/g;
const COMBINED_REGEX = /(@\w{2,30}|https?:\/\/[^\s)]+)/g;

export default function RichText({ text, style, numberOfLines }: Props) {
  const router = useRouter();
  const parts = text.split(COMBINED_REGEX);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, i) => {
        if (URL_REGEX.test(part)) {
          URL_REGEX.lastIndex = 0;
          return (
            <Text
              key={i}
              style={styles.link}
              onPress={() => {
                if (typeof window !== 'undefined') window.open(part, '_blank');
              }}
            >
              {part}
            </Text>
          );
        }
        if (MENTION_REGEX.test(part)) {
          MENTION_REGEX.lastIndex = 0;
          const username = part.slice(1); // remove @
          return (
            <Text
              key={i}
              style={styles.mention}
              onPress={() => {
                // Navigate to profile search or profile by username
                // For now, just highlight — profile lookup by username can be added
              }}
            >
              {part}
            </Text>
          );
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  link: {
    color: COLORS.blue,
    textDecorationLine: 'underline',
  },
  mention: {
    color: COLORS.gold,
    fontWeight: '700',
  },
});
