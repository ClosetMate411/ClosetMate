import React from 'react';
import { View, Text, Pressable, Modal, ScrollView, useWindowDimensions, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette } from '../../theme/colors';

export default function HomeScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  
  // Responsive sizing
  const isTablet = width > 768;
  const paddingHorizontal = isTablet ? Math.min(width * 0.1, 80) : 20;
  
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: '#fcfaff' }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={{ paddingHorizontal: paddingHorizontal, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 36, height: 36, backgroundColor: '#7136d4', borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                <MaterialCommunityIcons name="hanger" size={24} color="#fff" />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#321f66' }}>
                Closet<Text style={{ color: '#7136d4' }}>Mate</Text>
              </Text>
            </View>

            <Pressable onPress={() => setMenuOpen(true)} style={{ padding: 6 }}>
              <Ionicons name="menu" size={32} color="#64748b" />
            </Pressable>
          </View>

          {/* Hero Section */}
          <View style={{ alignItems: 'center', paddingHorizontal: paddingHorizontal + 10, paddingTop: isTablet ? 80 : 40, paddingBottom: 40 }}>
            <Text style={{ fontSize: isTablet ? 48 : 34, fontWeight: '800', color: '#5a2fc9', textAlign: 'center', marginBottom: 20 }}>
              Welcome to ClosetMate
            </Text>
            <Text style={{ fontSize: isTablet ? 20 : 16, fontWeight: '700', color: '#1e293b', textAlign: 'center', marginBottom: 16, lineHeight: isTablet ? 30 : 24 }}>
              Your smart wardrobe companion — simple, effortless clothing management.
            </Text>
            <Text style={{ fontSize: isTablet ? 16 : 14, color: '#64748b', textAlign: 'center', maxWidth: 640, marginBottom: 32, lineHeight: 22 }}>
              Digitize your wardrobe, remove backgrounds automatically, get AI outfit suggestions, 
              and share your style with a growing community.
            </Text>

            <Pressable
              onPress={() => navigation.navigate('Wardrobe')}
              style={{ paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, backgroundColor: '#5a2fc9', elevation: 2, shadowColor: '#5a2fc9', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>Go to Wardrobe</Text>
            </Pressable>
          </View>

          {/* Feature Cards List */}
          <View style={{ paddingHorizontal: paddingHorizontal }}>
            <ScrollView
              horizontal={true}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 16, paddingRight: paddingHorizontal, paddingVertical: 10 }}
            >
              <FeatureCard
                icon="home-outline"
                title="Wardrobe"
                description="Upload and organize your clothing items with automatic background removal."
                onPress={() => navigation.navigate('Wardrobe')}
                width={isTablet ? 320 : width * 0.75}
              />
              <FeatureCard
                icon="star-four-points-outline"
                title="Outfits"
                description="Let AI generate stylish outfit combinations from your wardrobe."
                onPress={() => navigation.navigate('Outfits')}
                width={isTablet ? 320 : width * 0.75}
              />
              <FeatureCard
                icon="account-group-outline"
                title="Community"
                description="Share outfits, discover styles, react to looks, and browse top-rated posts."
                onPress={() => navigation.navigate('Community')}
                width={isTablet ? 320 : width * 0.75}
              />
              <FeatureCard
                icon="account-circle-outline"
                title="Profile"
                description="Manage your avatar, see your shared outfits, and track your engagement stats."
                onPress={() => navigation.navigate('Profile')}
                width={isTablet ? 320 : width * 0.75}
              />
            </ScrollView>
          </View>

          {/* How to use section */}
          <View style={{ paddingHorizontal: paddingHorizontal, marginTop: 40, paddingBottom: 20 }}>
            <Text style={{ fontSize: isTablet ? 32 : 24, fontWeight: '800', color: '#321f66', marginBottom: 24 }}>
              How to use ClosetMate
            </Text>
            <View style={{ gap: 20 }}>
              <StepItem 
                number="1" 
                title="Digitize your wardrobe" 
                desc="Head to the Wardrobe tab and tap the '+' button to upload photos of your clothes. We'll automatically remove the backgrounds."
              />
              <StepItem 
                number="2" 
                title="Get AI outfit suggestions" 
                desc="Open the Outfits tab and let our smart AI generate stylish combinations using the items you uploaded."
              />
              <StepItem 
                number="3" 
                title="Engage with the community" 
                desc="Share your favorite looks to the Community feed, discover new styles, and react to others!"
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Floating Logout Button bottom right */}
      <Pressable 
        onPress={() => navigation.navigate('Logout')}
        style={{ 
          position: 'absolute', 
          right: paddingHorizontal, 
          bottom: Math.max(insets.bottom, 20),
          width: 50,
          height: 50,
          borderRadius: 25,
          backgroundColor: '#fff',
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 4,
          shadowColor: '#ef4444',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          borderWidth: 1,
          borderColor: '#fee2e2'
        }}
      >
        <Ionicons name="power" size={24} color="#ef4444" />
      </Pressable>

      {/* Basic Menu Modal */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setMenuOpen(false)} />
          <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: Math.min(320, width * 0.8), backgroundColor: '#fff', padding: 24, paddingTop: insets.top + 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
              <Text style={{ fontSize: 24, fontWeight: '800', color: '#321f66' }}>Menu</Text>
              <Pressable onPress={() => setMenuOpen(false)}>
                <Ionicons name="close" size={28} color="#64748b" />
              </Pressable>
            </View>

            <View style={{ gap: 24 }}>
              <MenuOption icon="account-circle-outline" title="Profile" onPress={() => { setMenuOpen(false); navigation.navigate('Profile'); }} />
              <MenuOption icon="home-outline" title="Wardrobe" onPress={() => { setMenuOpen(false); navigation.navigate('Wardrobe'); }} />
              <MenuOption icon="account-group-outline" title="Community" onPress={() => { setMenuOpen(false); navigation.navigate('Community'); }} />
              <MenuOption icon="star-four-points-outline" title="Outfits" onPress={() => { setMenuOpen(false); navigation.navigate('Outfits'); }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Subcomponents
function FeatureCard({ icon, title, description, onPress, width }) {
  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => {
        const isActive = pressed;
        return (
          <View
            style={{ 
              width: width,
              minHeight: 160,
              backgroundColor: '#fff', 
              borderRadius: 20, 
              padding: 24,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
              borderWidth: 1.5,
              borderColor: isActive ? '#d1baf4' : '#f1f5f9',
              shadowColor: '#5a2fc9',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: isActive ? 0.1 : 0.04,
              shadowRadius: 24,
              elevation: isActive ? 3 : 1
            }}
          >
            <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: isActive ? '#a64df5' : '#f1e8ff', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name={icon} size={32} color={isActive ? '#fff' : '#a64df5'} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#1e293b' }}>{title}</Text>
              <Text style={{ fontSize: 13, color: '#64748b', lineHeight: 18 }}>{description}</Text>
            </View>
            <View style={{ width: 24, alignItems: 'center' }}>
              <Ionicons name="chevron-forward" size={20} color={isActive ? '#a64df5' : '#cbd5e1'} />
            </View>
          </View>
        );
      }}
    </Pressable>
  );
}

function MenuOption({ icon, title, onPress }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#f1e8ff', alignItems: 'center', justifyContent: 'center' }}>
        <MaterialCommunityIcons name={icon} size={24} color="#a64df5" />
      </View>
      <Text style={{ fontSize: 18, fontWeight: '700', color: '#334155' }}>{title}</Text>
    </Pressable>
  );
}

function StepItem({ number, title, desc }) {
  return (
    <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#a64df5', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{number}</Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#1e293b' }}>{title}</Text>
        <Text style={{ fontSize: 14, color: '#64748b', lineHeight: 22 }}>{desc}</Text>
      </View>
    </View>
  );
}
