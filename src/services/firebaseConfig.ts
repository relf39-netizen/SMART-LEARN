import firebase from "firebase/compat/app";
import "firebase/compat/database";

// ---------------------------------------------------------------------------
// 🟢 ส่วนที่ต้องแก้ไข: นำโค้ดจาก Firebase Console มาวางทับตรงนี้
// ---------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyA1peT4SBvjSuCSiMM9l0DZW8N0MjUba5U",
  authDomain: "litleschool-8cdf9.firebaseapp.com",
  // URL ของฐานข้อมูล (ตรวจสอบให้ตรงกับ Location ที่คุณเลือก เช่น สิงคโปร์)
  databaseURL: "https://litleschool-8cdf9-default-rtdb.asia-southeast1.firebasedatabase.app", 
  projectId: "litleschool-8cdf9",
  storageBucket: "litleschool-8cdf9.firebasestorage.app",
  messagingSenderId: "718808446696",
  appId: "1:718808446696:web:f6433798e5230b1e473b5d",
  measurementId: "G-5C21W4F578"
};

// เริ่มต้นระบบ
const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
export const db = app.database();
export { firebase };