import React from 'react';
import { View, Text, Pressable, Modal, ScrollView, useWindowDimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const titleSize = Math.min(46, Math.max(30, width * 0.085));
  const subtitleSize = Math.min(32, Math.max(18, width * 0.055));
  const bodySize = Math.min(22, Math.max(15, width * 0.038));
  const buttonSize = Math.min(28, Math.max(18, width * 0.05));
  const panelWidth = Math.min(420, Math.max(300, width * 0.88));
  const menuTitleSize = Math.min(48, Math.max(34, width * 0.095));
  const itemTitleSize = Math.min(48, Math.max(20, width * 0.074));
  const itemSubtitleSize = Math.min(24, Math.max(14, width * 0.05));
  const itemIconBox = Math.min(96, Math.max(72, width * 0.2));
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: '#f3ecff' }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#fff' }}>
        <View style={{ height: 72, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#e7e7e7' }}>
          <View />

          <Pressable onPress={() => setMenuOpen(true)} hitSlop={8}>
            <Ionicons name="menu" size={28} color="#5f6368" />
          </Pressable>
        </View>
      </SafeAreaView>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 }}>
        <View style={{ width: '100%', maxWidth: 760, alignItems: 'center', paddingVertical: 24 }}>
          <Text style={{ fontSize: titleSize, fontWeight: '800', color: '#5a2fc9', textAlign: 'center', marginBottom: 18 }}>
            Welcome to ClosetMate
          </Text>
          <Text style={{ fontSize: subtitleSize, lineHeight: subtitleSize * 1.35, color: '#171717', textAlign: 'center', marginBottom: 22 }}>
            Your smart wardrobe companion — simple, effortless clothing management.
          </Text>
          <Text style={{ fontSize: bodySize, lineHeight: bodySize * 1.55, color: '#6b7280', textAlign: 'center', maxWidth: 940, marginBottom: 34 }}>
            ClosetMate helps you digitize and organize your wardrobe by transforming your clothing into a clean, visual collection.
            Upload images of your clothes, remove backgrounds automatically, and manage your items in one place — all through a simple and intuitive interface.
          </Text>

          <Pressable
            onPress={() => navigation.navigate('Wardrobe')}
            style={{ paddingVertical: 15, paddingHorizontal: 30, borderRadius: 12, alignItems: 'center', backgroundColor: '#8b46ea' }}
          >
            <Text style={{ fontSize: buttonSize, fontWeight: '700', color: '#fff' }}>Go To Wardrobe</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(122, 116, 145, 0.55)', alignItems: 'flex-end' }}>
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: panelWidth, bottom: 0 }} onPress={() => setMenuOpen(false)} />

          <View style={{ width: panelWidth, height: '100%', backgroundColor: '#f7f7f8', paddingHorizontal: 24, paddingTop: 66 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: menuTitleSize, fontWeight: '800', color: '#5a2fc9' }}>Menu</Text>
              <Pressable
                onPress={() => setMenuOpen(false)}
                style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: '#edeaf2', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="close" size={36} color="#6d7480" />
              </Pressable>
            </View>

            <View style={{ height: 1, backgroundColor: '#dfdfe2', marginTop: 20, marginBottom: 24 }} />

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}>
              <Pressable
                onPress={() => {
                  setMenuOpen(false);
                  navigation.navigate('Wardrobe');
                }}
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 26 }}
              >
                <View style={{ width: itemIconBox, height: itemIconBox, borderRadius: 24, backgroundColor: '#f4f4f5', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                  <MaterialCommunityIcons name="wardrobe-outline" size={34} color="#8b46ea" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: itemTitleSize, lineHeight: itemTitleSize * 1.1, fontWeight: '800', color: '#121820' }}>Wardrobe</Text>
                  <Text style={{ fontSize: itemSubtitleSize, lineHeight: itemSubtitleSize * 1.25, color: '#8f979e' }}>Manage your collection</Text>
                </View>
              </Pressable>

              <Pressable style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 26 }}>
                <View style={{ width: itemIconBox, height: itemIconBox, borderRadius: 24, backgroundColor: '#f4f4f5', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                  <MaterialCommunityIcons name="account-group-outline" size={33} color="#a476e8" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Text style={{ fontSize: itemTitleSize, lineHeight: itemTitleSize * 1.1, fontWeight: '700', color: '#5f646b', marginRight: 8 }}>Community</Text>
                    <View style={{ backgroundColor: '#d8c7ef', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 18, lineHeight: 24, fontWeight: '700', color: '#7a5eb8' }}>Soon</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: itemSubtitleSize, lineHeight: itemSubtitleSize * 1.25, color: '#b2b6bb' }}>Share with others</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  setMenuOpen(false);
                  navigation.navigate('Outfits');
                }}
                style={{ flexDirection: 'row', alignItems: 'center' }}
              >
                <View style={{ width: itemIconBox, height: itemIconBox, borderRadius: 24, backgroundColor: '#f4f4f5', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                  <MaterialCommunityIcons name="star-four-points-outline" size={33} color="#8b46ea" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: itemTitleSize, lineHeight: itemTitleSize * 1.1, fontWeight: '800', color: '#121820' }}>Outfits</Text>
                  <Text style={{ fontSize: itemSubtitleSize, lineHeight: itemSubtitleSize * 1.25, color: '#8f979e' }}>AI-generated combinations</Text>
                </View>
              </Pressable>

              <View style={{ flex: 1 }} />
              <Text style={{ textAlign: 'center', color: '#9aa1a9', fontSize: 16, marginTop: 24 }}>
                © 2026 ClosetMate
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
