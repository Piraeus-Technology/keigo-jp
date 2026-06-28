import React, { useEffect, useCallback } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';

import HomeScreen from './src/screens/HomeScreen';
import DetailScreen from './src/screens/DetailScreen';
import FeedbackScreen from './src/screens/FeedbackScreen';
import FlashcardScreen from './src/screens/FlashcardScreen';
import PatternGuideScreen from './src/screens/PatternGuideScreen';
import QuizScreen from './src/screens/QuizScreen';
import StatsScreen from './src/screens/StatsScreen';
import FlashcardStatsScreen from './src/screens/FlashcardStatsScreen';
import PracticeSettingsScreen from './src/screens/PracticeSettingsScreen';
import { useThemeStore } from './src/store/themeStore';
import { useColors, fonts } from './src/utils/theme';
import type {
  SearchStackParamList,
  QuizStackParamList,
  FlashcardStackParamList,
  MoreStackParamList,
} from './src/types/navigation';

SplashScreen.preventAutoHideAsync();

const SearchStack = createNativeStackNavigator<SearchStackParamList>();
const QuizStack = createNativeStackNavigator<QuizStackParamList>();
const FlashcardStack = createNativeStackNavigator<FlashcardStackParamList>();
const MoreStack = createNativeStackNavigator<MoreStackParamList>();
const Tab = createBottomTabNavigator();

function useStackScreenOptions() {
  const colors = useColors();
  return {
    headerStyle: { backgroundColor: colors.bg },
    headerTintColor: colors.primary,
    headerTitleStyle: {
      fontWeight: fonts.weights.semibold,
      color: colors.textPrimary,
    },
    headerTitleAlign: 'center' as const,
    headerShadowVisible: false,
    contentStyle: { backgroundColor: colors.bg },
  };
}

function SearchStackScreen() {
  const screenOptions = useStackScreenOptions();
  return (
    <SearchStack.Navigator id="SearchStack" screenOptions={screenOptions}>
      <SearchStack.Screen name="SearchHome" component={HomeScreen} options={{ title: 'Search' }} />
      <SearchStack.Screen
        name="Detail"
        component={DetailScreen}
        options={({ route }: { route: RouteProp<SearchStackParamList, 'Detail'> }) => ({
          title: route.params.key,
        })}
      />
    </SearchStack.Navigator>
  );
}

function QuizStackScreen() {
  const screenOptions = useStackScreenOptions();
  return (
    <QuizStack.Navigator id="QuizStack" screenOptions={screenOptions}>
      <QuizStack.Screen name="QuizMain" component={QuizScreen} options={{ title: 'Quiz' }} />
      <QuizStack.Screen
        name="PracticeSettings"
        component={PracticeSettingsScreen}
        options={{ title: 'Settings', presentation: 'modal' }}
      />
    </QuizStack.Navigator>
  );
}

function FlashcardStackScreen() {
  const screenOptions = useStackScreenOptions();
  return (
    <FlashcardStack.Navigator id="FlashcardStack" screenOptions={screenOptions}>
      <FlashcardStack.Screen name="FlashcardMain" component={FlashcardScreen} options={{ title: 'Flashcards' }} />
      <FlashcardStack.Screen
        name="PracticeSettings"
        component={PracticeSettingsScreen}
        options={{ title: 'Settings', presentation: 'modal' }}
      />
    </FlashcardStack.Navigator>
  );
}

function MoreStackScreen() {
  const screenOptions = useStackScreenOptions();
  return (
    <MoreStack.Navigator id="MoreStack" screenOptions={screenOptions}>
      <MoreStack.Screen name="MoreMain" component={FeedbackScreen} options={{ title: 'More' }} />
      <MoreStack.Screen name="Stats" component={StatsScreen} options={{ title: 'Quiz Stats' }} />
      <MoreStack.Screen name="FlashcardStats" component={FlashcardStatsScreen} options={{ title: 'Flashcard Stats' }} />
    </MoreStack.Navigator>
  );
}

export default function App() {
  const { isDark, loaded, loadTheme } = useThemeStore();
  const colors = useColors();

  useEffect(() => {
    loadTheme();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (loaded) {
      await SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) return null;

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background: colors.bg,
      card: colors.bg,
      text: colors.textPrimary,
      primary: colors.primary,
    },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
      />
      <NavigationContainer theme={navTheme}>
        <Tab.Navigator
          id="MainTabs"
          screenOptions={{
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.textMuted,
            tabBarStyle: {
              backgroundColor: colors.bg,
              borderTopColor: colors.divider,
            },
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: fonts.weights.medium,
            },
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.primary,
            headerTitleStyle: {
              fontWeight: fonts.weights.semibold,
              color: colors.textPrimary,
            },
            headerTitleAlign: 'center' as const,
            headerShadowVisible: false,
          }}
        >
          <Tab.Screen
            name="Search"
            component={SearchStackScreen}
            options={{
              headerShown: false,
              tabBarLabel: 'Search',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="search" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="Quiz"
            component={QuizStackScreen}
            options={{
              headerShown: false,
              tabBarLabel: 'Quiz',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="school" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="Flashcards"
            component={FlashcardStackScreen}
            options={{
              headerShown: false,
              tabBarLabel: 'Cards',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="layers" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="Guide"
            component={PatternGuideScreen}
            options={{
              title: 'Pattern Guide',
              tabBarLabel: 'Guide',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="book" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="More"
            component={MoreStackScreen}
            options={{
              headerShown: false,
              tabBarLabel: 'More',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="ellipsis-horizontal" size={size} color={color} />
              ),
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
