import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import HomeScreen from '../screens/HomeScreen';
import MarkAttendanceScreen from '../screens/MarkAttendanceScreen';
import MonthlyAttendanceScreen from '../screens/MonthlyAttendanceScreen';
import ProfileScreen from '../screens/ProfileScreen';
import TrackMeScreen from '../screens/TrackMeScreen';
import ShowMyTripScreen from '../screens/ShowMyTripScreen';
import type { AppStackParamList } from './types';

const Stack = createNativeStackNavigator<AppStackParamList>();

const HEADER_OPTIONS = {
  headerStyle: { backgroundColor: '#4F46E5' },
  headerTintColor: '#FFFFFF',
  headerTitleStyle: { fontWeight: '700' as const },
};

function RootNavigator() {
  const { user, provisioned } = useAuth();

  return (
    <Stack.Navigator>
      {!user ? (
        <>
          {!provisioned && (
            <Stack.Screen name="SignUp" component={SignUpScreen} options={{ headerShown: false }} />
          )}
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        </>
      ) : (
        <>
          <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
          <Stack.Screen
            name="MarkAttendance"
            component={MarkAttendanceScreen}
            options={{ ...HEADER_OPTIONS, title: 'Mark Attendance' }}
          />
          <Stack.Screen
            name="MonthlyAttendance"
            component={MonthlyAttendanceScreen}
            options={{ ...HEADER_OPTIONS, title: 'Monthly Attendance' }}
          />
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{ ...HEADER_OPTIONS, title: 'Profile' }}
          />
          <Stack.Screen
            name="TrackMe"
            component={TrackMeScreen}
            options={{ ...HEADER_OPTIONS, title: 'Track Me' }}
          />
          <Stack.Screen
            name="ShowMyTrip"
            component={ShowMyTripScreen}
            options={{ ...HEADER_OPTIONS, title: 'Show My Trip' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

export default RootNavigator;
