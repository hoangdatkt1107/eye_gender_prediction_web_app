import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, ActivityIndicator, Alert, ScrollView, SafeAreaView, TextInput, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export default function App() {
  const [leftEye, setLeftEye] = useState(null);
  const [rightEye, setRightEye] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [currentRecordId, setCurrentRecordId] = useState(null);
  
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Responsive Hook: Checks if the screen is wider than a tablet
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const getSafeImageUri = (base64Data) => {
    if (!base64Data) return null;
    let cleanData = String(base64Data).replace(/[\r\n]+/gm, ''); 
    if (cleanData.startsWith('data:image')) {
      return cleanData; 
    } else {
      return `data:image/jpeg;base64,${cleanData}`; 
    }
  };

  const analyzeImages = async () => {
    if (!leftEye || !rightEye) {
      Alert.alert("Awaiting Input", "Please provide both ocular scans to proceed.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();

      if (Platform.OS === 'web') {
        const leftResponse = await fetch(leftEye);
        const leftBlob = await leftResponse.blob();
        formData.append('left_eye', leftBlob, 'l.jpg');

        const rightResponse = await fetch(rightEye);
        const rightBlob = await rightResponse.blob();
        formData.append('right_eye', rightBlob, 'r.jpg');
      } else {
        formData.append('left_eye', { uri: leftEye, name: 'l.jpg', type: 'image/jpeg' });
        formData.append('right_eye', { uri: rightEye, name: 'r.jpg', type: 'image/jpeg' });
      }

      const response = await fetch('https://masonhoang1107-eye-gender-api-v2.hf.space/predict', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      
      if (response.ok) {
        setResult(data);
        setCurrentRecordId(data.record_id); 
      } else {
        Alert.alert("Analysis Failed", data.detail || "The AI is currently unreachable.");
      }
    } catch (e) {
      Alert.alert("Connection Dropped", "Please verify your network connection.");
    } finally {
      setLoading(false);
    }
  };

  const sendRealFeedback = async (choice) => {
    if (!currentRecordId) return;
    try {
      const response = await fetch('https://masonhoang1107-eye-gender-api-v2.hf.space/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record_id: currentRecordId, actual_label: choice })
      });
      if (response.ok) {
        Alert.alert("Model Updated", `Feedback logged as: ${choice} ✨`);
        setResult(null); setLeftEye(null); setRightEye(null);
        if(showHistory) fetchHistory();
      } else {
        Alert.alert("Sync Error", "Could not synchronize with the Supabase vault.");
      }
    } catch (e) {
      Alert.alert("Network Error", "Feedback payload failed to deliver.");
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await fetch(`https://masonhoang1107-eye-gender-api-v2.hf.space/history?password_inserted=${passwordInput}`);
      const data = await response.json();
      if (response.ok && data.data) {
        setHistory(data.data.slice(0, 10));
        setShowHistory(true);
      } else {
        Alert.alert("Access Denied", "Invalid credentials.");
      }
    } catch (error) {
      Alert.alert("Vault Locked", "Could not establish a secure connection to logs.");
    } finally {
      setLoadingHistory(false);
    }
  };

  const pickImage = async (side) => {
    let res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!res.canceled) {
      if (side === 'left') setLeftEye(res.assets[0].uri);
      else setRightEye(res.assets[0].uri);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
        <ScrollView contentContainerStyle={styles.scrollWrapper} showsVerticalScrollIndicator={false}>
          
          {/* 💻 WEB UPGRADE: The Central Dashboard Card */}
          <View style={[styles.mainAppContainer, isDesktop && styles.desktopCard]}>
            
            <View style={styles.headerBox}>
              <Text style={styles.header}>EYEGEN <Text style={styles.headerAccent}>AI</Text></Text>
              <View style={styles.brandBadge}>
                <Text style={styles.subtitle}>ARCHITECTED BY DAT HOANG</Text>
              </View>
            </View>

            <View style={styles.uploadRow}>
              <TouchableOpacity style={[styles.box, leftEye && styles.boxActive, Platform.select({ web: { cursor: 'pointer' } })]} onPress={() => pickImage('left')}>
                {leftEye ? <Image source={{ uri: leftEye }} style={styles.img} /> : 
                  <View style={styles.placeholder}><Text style={styles.iconText}>✧</Text><Text style={styles.label}>Left Eye</Text></View>
                }
              </TouchableOpacity>
              <TouchableOpacity style={[styles.box, rightEye && styles.boxActive, Platform.select({ web: { cursor: 'pointer' } })]} onPress={() => pickImage('right')}>
                {rightEye ? <Image source={{ uri: rightEye }} style={styles.img} /> : 
                  <View style={styles.placeholder}><Text style={styles.iconText}>✧</Text><Text style={styles.label}>Right Eye</Text></View>
                }
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.btn, Platform.select({ web: { cursor: 'pointer' } })]} onPress={analyzeImages} disabled={loading}>
              {loading ? <ActivityIndicator color="#090A0F" size="small" /> : <Text style={styles.btnText}>INITIATE ANALYSIS</Text>}
            </TouchableOpacity>

            {result && (
              <View style={styles.resCard}>
                <Text style={styles.resSup}>PREDICTED DEMOGRAPHIC</Text>
                <Text style={styles.resText}>{result.prediction}</Text>
                
                <View style={styles.confidenceBarContainer}>
                  <View style={[styles.confidenceBarFill, { width: `${result.confidence * 100}%` }]} />
                </View>
                <Text style={styles.resConf}>{(result.confidence * 100).toFixed(1)}% Confidence Matrix</Text>
                
                <View style={styles.divider} />
                
                {(result.plot_L || result.plot_R) ? (
                  <View style={styles.processedImagesRow}>
                    {result.plot_L && (
                      <View style={styles.processedWrapper}>
                        <Image source={{ uri: getSafeImageUri(result.plot_L) }} style={styles.processedImg} />
                        <Text style={styles.processedLabel}>AI SCANNED: LEFT</Text>
                      </View>
                    )}
                    {result.plot_R && (
                      <View style={styles.processedWrapper}>
                        <Image source={{ uri: getSafeImageUri(result.plot_R) }} style={styles.processedImg} />
                        <Text style={styles.processedLabel}>AI SCANNED: RIGHT</Text>
                      </View>
                    )}
                  </View>
                ) : null}

                <Text style={styles.feedTitle}>CALIBRATE AI MODEL</Text>
                <View style={styles.fRow}>
                   <TouchableOpacity style={[styles.fBtn, {backgroundColor: '#1E3A2F', borderColor: '#2E5A47', borderWidth: 1}, Platform.select({ web: { cursor: 'pointer' } })]} onPress={() => sendRealFeedback("Correct")}>
                      <Text style={[styles.fBtnT, {color: '#4ade80'}]}>Confirm Prediction</Text>
                   </TouchableOpacity>
                   <TouchableOpacity style={[styles.fBtn, {backgroundColor: '#3A1E1E', borderColor: '#5A2E2E', borderWidth: 1}, Platform.select({ web: { cursor: 'pointer' } })]} onPress={() => sendRealFeedback("Male")}>
                      <Text style={[styles.fBtnT, {color: '#f87171'}]}>Override: Male</Text>
                   </TouchableOpacity>
                   <TouchableOpacity style={[styles.fBtn, {backgroundColor: '#3A1E1E', borderColor: '#5A2E2E', borderWidth: 1}, Platform.select({ web: { cursor: 'pointer' } })]} onPress={() => sendRealFeedback("Female")}>
                      <Text style={[styles.fBtnT, {color: '#f87171'}]}>Override: Female</Text>
                   </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.logSec}>
              <Text style={styles.logTitle}>SUPABASE VAULT</Text>
              {!showHistory ? (
                <View style={styles.vaultEntry}>
                  <TextInput style={styles.input} placeholder="Enter Security Key" placeholderTextColor="#555" secureTextEntry value={passwordInput} onChangeText={setPasswordInput}/>
                  <TouchableOpacity style={[styles.unlockBtn, Platform.select({ web: { cursor: 'pointer' } })]} onPress={fetchHistory} disabled={loadingHistory}>
                    {loadingHistory ? <ActivityIndicator color="#D4AF37" /> : <Text style={styles.unlockText}>DECRYPT LOGS</Text>}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.historyContainer}>
                  {history.length > 0 ? history.map((h, i) => (
                    <View key={i} style={styles.hItem}>
                      <View><Text style={styles.hId}>ID: {h.id}</Text><Text style={styles.hDate}>{h.timestamp}</Text></View>
                      <View style={{alignItems: 'flex-end'}}><Text style={styles.hPred}>{h.prediction}</Text><Text style={styles.hLabel}>Label: {h.actual_label}</Text></View>
                    </View>
                  )) : <Text style={styles.emptyLogs}>Vault is currently empty.</Text>}
                  <TouchableOpacity onPress={fetchHistory} style={[styles.refreshBtn, Platform.select({ web: { cursor: 'pointer' } })]}><Text style={styles.refreshText}>⟳ Sync Vault</Text></TouchableOpacity>
                </View>
              )}
            </View>

          </View>
          <View style={{height: 100}} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050508' }, // Slightly darker background for the web page
  scrollWrapper: { flexGrow: 1, justifyContent: 'center' },
  
  // Base container (Full width on mobile)
  mainAppContainer: { width: '100%', alignItems: 'center', padding: 20 },
  
  // 💻 DESKTOP UPGRADE: The specific styles applied only when viewed on a computer monitor
  desktopCard: {
    maxWidth: 700,
    alignSelf: 'center',
    backgroundColor: '#090A0F', // Main app color
    marginTop: 40,
    padding: 50,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#1A1C29',
    // Premium Gold Glow behind the web app
    shadowColor: '#D4AF37', 
    shadowOffset: { width: 0, height: 15 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 40,
  },

  headerBox: { alignItems: 'center', marginBottom: 40 },
  header: { fontSize: 42, fontWeight: '200', color: '#FFF', letterSpacing: 4 },
  headerAccent: { fontWeight: '800', color: '#D4AF37' },
  brandBadge: { marginTop: 12, paddingHorizontal: 15, paddingVertical: 6, backgroundColor: 'rgba(212, 175, 55, 0.1)', borderRadius: 20, borderWidth: 0.5, borderColor: 'rgba(212, 175, 55, 0.3)' },
  subtitle: { fontSize: 10, color: '#D4AF37', letterSpacing: 3, fontWeight: '700' },
  uploadRow: { flexDirection: 'row', gap: 20, marginBottom: 35 },
  box: { width: 145, height: 160, backgroundColor: '#12141D', borderRadius: 25, borderWidth: 1, borderColor: '#1F2233', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 15 },
  boxActive: { borderColor: '#D4AF37', borderWidth: 1.5 },
  img: { width: '100%', height: '100%' },
  placeholder: { alignItems: 'center', opacity: 0.6 },
  iconText: { fontSize: 24, color: '#D4AF37', marginBottom: 8 },
  label: { color: '#888C9E', fontSize: 13, fontWeight: '600', letterSpacing: 1 },
  
  // Replaced absolute width with 100% to fit the responsive dashboard layout
  btn: { backgroundColor: '#D4AF37', width: '100%', padding: 22, borderRadius: 16, alignItems: 'center', shadowColor: '#D4AF37', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 15 },
  btnText: { color: '#090A0F', fontSize: 15, fontWeight: '800', letterSpacing: 2 },
  
  resCard: { width: '100%', backgroundColor: '#12141D', marginTop: 40, padding: 25, borderRadius: 25, borderWidth: 1, borderColor: '#1F2233' },
  resSup: { color: '#888C9E', fontSize: 10, letterSpacing: 2, textAlign: 'center', marginBottom: 5 },
  resText: { fontSize: 42, fontWeight: '300', textAlign: 'center', color: '#FFF', letterSpacing: 1 },
  confidenceBarContainer: { height: 4, backgroundColor: '#1F2233', borderRadius: 2, marginTop: 20, marginBottom: 10, overflow: 'hidden' },
  confidenceBarFill: { height: '100%', backgroundColor: '#D4AF37' },
  resConf: { fontSize: 12, color: '#D4AF37', textAlign: 'center', fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#1F2233', marginVertical: 25 },
  
  processedImagesRow: { flexDirection: 'row', gap: 15, marginBottom: 25, justifyContent: 'center' },
  processedWrapper: { flex: 1, alignItems: 'center' },
  processedImg: { width: 130, height: 130, borderRadius: 15, borderWidth: 1.5, borderColor: '#D4AF37' },
  processedLabel: { color: '#888C9E', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginTop: 10 },
  
  feedTitle: { textAlign: 'center', color: '#888C9E', marginBottom: 15, fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  fRow: { flexDirection: 'row', gap: 10 },
  fBtn: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  fBtnT: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textAlign: 'center' },
  logSec: { width: '100%', marginTop: 50 },
  logTitle: { fontSize: 14, color: '#FFF', letterSpacing: 3, fontWeight: '700', marginBottom: 20, textAlign: 'center' },
  vaultEntry: { backgroundColor: '#12141D', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#1F2233' },
  input: { backgroundColor: '#050508', padding: 18, borderRadius: 12, color: '#FFF', fontSize: 16, borderWidth: 1, borderColor: '#1F2233', marginBottom: 15, textAlign: 'center', letterSpacing: 2, outlineStyle: 'none' },
  unlockBtn: { backgroundColor: '#1F2233', padding: 18, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#333752' },
  unlockText: { color: '#D4AF37', fontWeight: '700', letterSpacing: 2, fontSize: 13 },
  historyContainer: { backgroundColor: '#12141D', borderRadius: 20, padding: 15, borderWidth: 1, borderColor: '#1F2233' },
  hItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1, borderColor: '#1F2233' },
  hId: { color: '#888C9E', fontSize: 11, fontWeight: '700' },
  hDate: { color: '#555', fontSize: 10, marginTop: 4 },
  hPred: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  hLabel: { color: '#D4AF37', fontSize: 11, marginTop: 4 },
  emptyLogs: { color: '#888C9E', textAlign: 'center', padding: 20 },
  refreshBtn: { marginTop: 15, alignItems: 'center', padding: 10 },
  refreshText: { color: '#D4AF37', fontSize: 12, fontWeight: '600', letterSpacing: 1 }
});