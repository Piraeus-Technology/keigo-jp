import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Search: undefined;
  Detail: {
    key: string;
    type: 'verb' | 'expression';
  };
  Feedback: undefined;
  Quiz: undefined;
  Guide: undefined;
};

export type SearchScreenProps = NativeStackScreenProps<RootStackParamList, 'Search'>;
export type DetailScreenProps = NativeStackScreenProps<RootStackParamList, 'Detail'>;
export type FeedbackScreenProps = NativeStackScreenProps<RootStackParamList, 'Feedback'>;
export type QuizScreenProps = NativeStackScreenProps<RootStackParamList, 'Quiz'>;
