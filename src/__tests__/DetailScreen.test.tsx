import React from 'react';
import { render } from '@testing-library/react-native';
import DetailScreen from '../screens/DetailScreen';
import { getDetailHeaderTitle } from '../utils/expressionDisplay';

let mockRouteParams: {
  key: string;
  type: 'verb' | 'expression';
} = {
  key: '申す',
  type: 'verb',
};

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('../store/favoritesStore', () => ({
  useFavoritesStore: () => ({
    isFavorite: () => false,
    toggleFavorite: jest.fn(),
    loadFavorites: jest.fn(),
  }),
}));

jest.mock('../utils/speech', () => ({
  speak: jest.fn(),
}));

jest.mock('../components/SpeakButton', () => {
  // Jest hoists mock factories, so dependencies must be loaded inside it.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { TouchableOpacity } = require('react-native');
  return function MockSpeakButton({
    text,
    accessibilityLabel,
  }: {
    text: string;
    accessibilityLabel?: string;
  }) {
    return React.createElement(TouchableOpacity, {
      accessibilityRole: 'button',
      accessibilityLabel:
        accessibilityLabel ?? `Play pronunciation of ${text}`,
    });
  };
});

describe('DetailScreen', () => {
  test('renders every self-form humble verb with its complete detail data', () => {
    const keys = ['拝借する', '存じる', '承る', '申し上げる', '申す'];

    for (const key of keys) {
      mockRouteParams = { key, type: 'verb' };
      const view = render(<DetailScreen />);

      expect(view.getAllByText(key).length).toBeGreaterThanOrEqual(2);
      expect(view.getByText('Keigo Forms (敬語)')).toBeTruthy();
      if (key === '申す') {
        expect(view.getByLabelText('Play pronunciation of もうす')).toBeTruthy();
      }
      view.unmount();
    }
  });

  test('shows the full longest expression in content and uses a stable header title', () => {
    const key =
      '失礼ですが、もう一度お名前をお伺いしてもよろしいでしょうか';
    mockRouteParams = { key, type: 'expression' };
    const view = render(<DetailScreen />);

    expect(view.getByText(key)).toBeTruthy();
    expect(getDetailHeaderTitle(mockRouteParams)).toBe('Expression');
  });

  test('presents the absent humble form for dying without pronunciation', () => {
    mockRouteParams = { key: '死ぬ', type: 'verb' };
    const view = render(<DetailScreen />);

    expect(view.getAllByText('死ぬ')).toHaveLength(1);
    expect(view.getByText('No canonical form')).toBeTruthy();
    expect(view.getByText('There is no canonical humble form for dying.'))
      .toBeTruthy();
    expect(view.queryByLabelText('Play pronunciation of しぬ')).toBeNull();
  });

  test('shows an unconditional canonical form and its conditional alternative', () => {
    mockRouteParams = { key: '利用する', type: 'verb' };
    const view = render(<DetailScreen />);

    expect(view.getByText('Humble class: 謙譲語II（丁重語）')).toBeTruthy();
    expect(view.getByText('利用いたす')).toBeTruthy();
    expect(view.getByLabelText('Play pronunciation of りよういたす'))
      .toBeTruthy();
    expect(view.queryByText('Applies when')).toBeNull();
    expect(view.getByText('Alternatives')).toBeTruthy();
    expect(view.getByText(
      '利用させていただく（りようさせていただく）',
    )).toBeTruthy();
    expect(view.getByText(
      '• Use when the facility or service is used with the provider\'s permission and the speaker benefits from being allowed to use it.',
    )).toBeTruthy();
    expect(view.getByLabelText(
      'Play pronunciation of りようさせていただく',
    )).toBeTruthy();
  });

  test('keeps conditional metadata outside the pronunciation control', () => {
    mockRouteParams = { key: '着る', type: 'verb' };
    const view = render(<DetailScreen />);

    expect(view.getByText('Applies when')).toBeTruthy();
    expect(view.getByText(
      '• The listener or a third party permits the speaker to wear something, and the speaker benefits from that permission.',
    )).toBeTruthy();
    expect(view.getByLabelText('Play pronunciation of きさせていただく'))
      .toBeTruthy();
  });

  test('leaves an unannotated form row free of metadata chrome', () => {
    mockRouteParams = { key: '食べる', type: 'verb' };
    const view = render(<DetailScreen />);

    expect(view.getByText('いただく')).toBeTruthy();
    expect(view.getByLabelText('Play pronunciation of いただく'))
      .toBeTruthy();
    expect(view.queryByText('Applies when')).toBeNull();
    expect(view.queryByText('Alternatives')).toBeNull();
    expect(view.queryByText(/^Humble class:/)).toBeNull();
  });

  test('leaves verb and short-expression header titles unchanged', () => {
    expect(getDetailHeaderTitle({ key: '申し上げる', type: 'verb' }))
      .toBe('申し上げる');
    expect(getDetailHeaderTitle({ key: '恐れ入ります', type: 'expression' }))
      .toBe('恐れ入ります');
  });
});
