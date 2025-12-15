import React from 'react';
import { View, Text } from 'react-native';

export default function ScoreScreen({ route }) {
  const { score } = route.params;

  return (
    <View>
      <Text>Score: {score.points}</Text>
      <Text>Level: {score.level}</Text>
    </View>
  );
}
