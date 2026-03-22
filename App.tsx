import React, { useEffect, useCallback } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
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
import { useThemeStore } from './src/store/themeStore';
import { useColors, fonts } from './src/utils/theme';

SplashScreen.preventAutoHideAsync();

const SearchStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function SearchStackScreen() {
  const colors = useColors();

  return (
    <SearchStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.primary,
        headerTitleStyle: {
          fontWeight: fonts.weights.semibold,
          color: colors.textPrimary,
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <SearchStack.Screen
        name="SearchHome"
        component={HomeScreen}
        options={{
          title: 'Search',
        }}
      />
      <SearchStack.Screen
        name="Detail"
        component={DetailScreen}
        options={({ route }: any) => ({
          title: route.params.key,
        })}
      />
    </SearchStack.Navigator>
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
            component={QuizScreen}
            options={{
              title: 'Quiz',
              tabBarLabel: 'Quiz',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="school" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="Flashcards"
            component={FlashcardScreen}
            options={{
              title: 'Flashcards',
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
            component={FeedbackScreen}
            options={{
              title: 'More',
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
