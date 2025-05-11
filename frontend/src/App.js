import React, { useRef, useState } from 'react';
import { BrowserRouter as Router, Route, Routes, useNavigate } from 'react-router-dom';
import Tesseract from 'tesseract.js';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';

// Helper function
const simulateOptions = (refundAmount, payPeriods = 26) => {
  const round = (value) => Math.round(value * 100) / 100;

  return [
    {
      label: "Bigger Paycheck Now",
      refund: round(refundAmount * 0.3),
      perCheckGain: round((refundAmount * 0.7) / payPeriods),
      note: "Get more money now and a smaller refund later."
    },
    {
      label: "Balanced Option",
      refund: round(refundAmount * 0.6),
      perCheckGain: round((refundAmount * 0.4) / payPeriods),
      note: "Split the difference between paycheck and refund."
    },
    {
      label: "Bigger Refund Later",
      refund: round(refundAmount),
      perCheckGain: 0,
      note: "Stick to your current setup for a larger refund."
    }
  ];
};

const Welcome = () => {
  const navigate = useNavigate();
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Welcome to PayCheckRight</h1>
      <p>Get more money in your paycheck — without surprises at tax time.</p>
      <button onClick={() => navigate('/upload')} style={{ padding: '1rem 2rem', fontSize: '1rem' }}>
        Let’s Get Started
      </button>
    </div>
  );
};

const UploadPaystub = () => {
  const fileInputRef = useRef();
  const navigate = useNavigate();
  const [previewUrl, setPreviewUrl] = useState(null);
  const [ocrText, setOcrText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileURL = URL.createObjectURL(file);
    setPreviewUrl(fileURL);
    setIsProcessing(true);

    try {
      const result = await Tesseract.recognize(file, 'eng', {
        logger: (m) => console.log(m),
      });

      const extractedText = result.data.text;
      setOcrText(extractedText);

      const response = await axios.post(
        'https://paycheckright-backend.onrender.com/analyze-paystub',
        { text: extractedText }
      );

      const analysis = response.data;
      const suggestions = simulateOptions(analysis.estimated_refund);
      const payload = { ...analysis, suggestions };

      localStorage.setItem('paycheckright_analysis', JSON.stringify(payload));
      navigate('/results');
    } catch (error) {
      console.error('OCR or backend error:', error);
      setOcrText('Failed to process image.');
    }

    setIsProcessing(false);
  };

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>Upload Your Paystub</h2>
      <p>Upload a PDF or take a picture using your phone camera.</p>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <button onClick={() => fileInputRef.current.click()} style={{ padding: '1rem 2rem', fontSize: '1rem' }}>
        Take Photo / Upload File
      </button>

      {previewUrl && <img src={previewUrl} alt="Preview" style={{ marginTop: '1rem', maxWidth: '100%' }} />}
      {isProcessing && <p>Processing image with OCR...</p>}
      {ocrText && (
        <div style={{ marginTop: '1.5rem', textAlign: 'left' }}>
          <h4>Extracted Text:</h4>
          <pre>{ocrText}</pre>
        </div>
      )}
    </div>
  );
};

const Results = () => {
  const result = JSON.parse(localStorage.getItem('paycheckright_analysis') || '{}');
  const [sliderValue, setSliderValue] = useState(30);
  const handleSliderChange = (e, value) => setSliderValue(value);

  const refundTotal = result.estimated_refund ?? 0;
  const payPeriods = 26;
  const customRefund = ((100 - sliderValue) / 100) * refundTotal;
  const customPerCheck = (sliderValue / 100) * refundTotal / payPeriods;

  const chartData = result.suggestions?.map(option => ({
    name: option.label,
    'Refund Amount': option.refund,
    'Per Paycheck Gain': option.perCheckGain
  })) || [];

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Tax Estimate Results</h2>
      <p><strong>Gross Pay:</strong> ${result.gross_pay ?? 'Not found'}</p>
      <p><strong>YTD Withheld:</strong> ${result.ytd_withheld ?? 'Not found'}</p>
      <p><strong>Estimated Tax Owed:</strong> ${result.estimated_tax_owed ?? 'N/A'}</p>
      <p><strong>Estimated Refund:</strong> ${result.estimated_refund ?? 'N/A'}</p>

      {result.suggestions && (
        <>
          <h3>W-4 Adjustment Options:</h3>
          {result.suggestions.map((option, index) => (
            <div key={index} style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '1rem', marginTop: '1rem' }}>
              <h4>{option.label} {option.label.includes("Paycheck") ? "💸" : option.label.includes("Refund") ? "💰" : "⚖️"}</h4>
              <p><strong>Projected Refund:</strong> ${option.refund} 💰</p>
              <p><strong>Extra Per Paycheck:</strong> ${option.perCheckGain} 📅</p>
              <p style={{ fontSize: '0.9rem', color: '#555' }}>{option.note}</p>
            </div>
          ))}

          <div style={{ marginTop: '2rem' }}>
            <h4>Visual Comparison</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => `$${value}`} />
                <Tooltip formatter={(value, name) => [`$${value}`, name]} />
                <Legend />
                <Bar dataKey="Refund Amount" fill="#4a90e2" radius={[8, 8, 0, 0]} />
                <Bar dataKey="Per Paycheck Gain" fill="#00c49f" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ marginTop: '3rem' }}>
            <Typography gutterBottom>Customize Your Preference:</Typography>
            <Slider
              value={sliderValue}
              onChange={handleSliderChange}
              min={0}
              max={100}
              step={5}
              valueLabelDisplay="auto"
            />
            <p><strong>Per Paycheck Gain:</strong> ${customPerCheck.toFixed(2)} 📅</p>
            <p><strong>Projected Refund:</strong> ${customRefund.toFixed(2)} 💰</p>
          </div>
        </>
      )}
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/upload" element={<UploadPaystub />} />
        <Route path="/results" element={<Results />} />
      </Routes>
    </Router>
  );
}

export default App;
