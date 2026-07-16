import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { post } from '../api';

export default function ImportCSV() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [csvText, setCsvText] = useState('');
  const [separator, setSeparator] = useState(',');
  const [parsedData, setParsedData] = useState(null);
  const [error, setError] = useState('');

  const importMutation = useMutation({
    mutationFn: (data) => post('/import', data),
    onSuccess: (res) => {
      qc.invalidateQueries();
      alert(`Successfully imported: ${res.clientsCount} clients, ${res.salesCount} sales, and ${res.paymentsCount} payments!`);
      navigate('/');
    },
    onError: (err) => {
      setError(err.message || 'Import failed.');
    }
  });

  const handleParse = () => {
    try {
      setError('');
      if (!csvText.trim()) {
        setError('Please paste some CSV data first.');
        return;
      }

      const lines = csvText.split('\n').map(line => line.trim()).filter(Boolean);
      if (lines.length < 2) {
        setError('CSV data must contain at least a header row and one data row.');
        return;
      }

      // Simple CSV parser that handles basic quotes
      const parseCSVLine = (text, sep) => {
        const result = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === sep && !inQuotes) {
            result.push(cur.trim().replace(/^"|"$/g, ''));
            cur = '';
          } else {
            cur += char;
          }
        }
        result.push(cur.trim().replace(/^"|"$/g, ''));
        return result;
      };

      const headers = parseCSVLine(lines[0].toLowerCase(), separator);
      
      // Auto map column indexes
      const colMap = {
        date: headers.findIndex(h => h.includes('date') && !h.includes('paid')),
        customer: headers.findIndex(h => h.includes('customer') || h.includes('client')),
        item: headers.findIndex(h => h.includes('item') || h.includes('type')),
        quantity: headers.findIndex(h => h.includes('qty') || h.includes('quantity')),
        price: headers.findIndex(h => h.includes('price') || h.includes('single')),
        total: headers.findIndex(h => h.includes('total') && !h.includes('unpaid')),
        paidAmount: headers.findIndex(h => h.includes('paid amount') || h.includes('paid') && !h.includes('date')),
        paidDate: headers.findIndex(h => h.includes('paid date')),
        reminder: headers.findIndex(h => h.includes('reminder') || h.includes('note') || h.includes('method')),
      };

      // Fallback column indexing if headers don't match
      if (colMap.customer === -1) {
        setError('Could not identify "customer" column in the header row. Please verify headers.');
        return;
      }

      const clientsToCreate = [];
      const salesToCreate = [];
      const paymentsToCreate = [];

      const clientKeys = new Set();

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i], separator);
        if (cols.length < headers.length) continue;

        // Parse customer code if any (e.g. "mubaric C001")
        const customerVal = cols[colMap.customer] || '';
        if (!customerVal.trim()) continue;

        let clientName = customerVal;
        let clientCode = '';
        const codeMatch = customerVal.match(/\b([CS]\d{3,4})\b/i);
        if (codeMatch) {
          clientCode = codeMatch[1].toUpperCase();
          clientName = customerVal.replace(codeMatch[0], '').trim();
        }

        const clientKey = (clientCode || clientName).toLowerCase();
        if (!clientKeys.has(clientKey)) {
          clientKeys.add(clientKey);
          clientsToCreate.push({ name: clientName, code: clientCode });
        }

        const dateVal = cols[colMap.date] || new Date().toISOString().slice(0, 10);
        
        // Parse sale transaction if quantity & price present
        const itemVal = colMap.item !== -1 ? cols[colMap.item] : 'Flour';
        const qtyVal = colMap.quantity !== -1 ? parseFloat(cols[colMap.quantity]) : 0;
        const priceVal = colMap.price !== -1 ? parseFloat(cols[colMap.price]) : 0;
        const totalVal = colMap.total !== -1 ? parseFloat(cols[colMap.total]) : (qtyVal * priceVal);
        const reminderVal = colMap.reminder !== -1 ? cols[colMap.reminder] : '';

        if (qtyVal > 0 && priceVal > 0) {
          salesToCreate.push({
            date: new Date(dateVal).toISOString(),
            clientName,
            clientCode,
            itemName: itemVal || 'Flour 50kg',
            quantity: qtyVal,
            unitPrice: priceVal,
            total: totalVal,
            note: reminderVal
          });
        }

        // Parse payment if paid amount present
        const paidAmtVal = colMap.paidAmount !== -1 ? parseFloat(cols[colMap.paidAmount]) : 0;
        const paidDateVal = (colMap.paidDate !== -1 && cols[colMap.paidDate]) ? cols[colMap.paidDate] : dateVal;
        
        if (paidAmtVal > 0) {
          paymentsToCreate.push({
            date: new Date(paidDateVal).toISOString(),
            clientName,
            clientCode,
            amount: paidAmtVal,
            method: reminderVal.toLowerCase().includes('cbe') ? 'CBE' : reminderVal.toLowerCase().includes('cash') ? 'Cash' : 'Imported',
            note: reminderVal
          });
        }
      }

      setParsedData({
        clients: clientsToCreate,
        sales: salesToCreate,
        payments: paymentsToCreate
      });

    } catch (err) {
      setError(`Parsing error: ${err.message}`);
    }
  };

  const handleImport = () => {
    if (!parsedData) return;
    importMutation.mutate(parsedData);
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>CSV Bulk Import (Excel Migrator)</h1>
      </header>

      <section className="panel">
        <p className="hint" style={{ marginBottom: '12px' }}>
          Paste rows from your credit sheet. The first row must contain headers like: 
          <code>date, customer, type of item, quantity, single price, paid amount, reminder</code>.
        </p>

        <div className="form" style={{ gap: '16px' }}>
          <div className="form-row" style={{ gridTemplateColumns: '200px 1fr' }}>
            <label>
              Separator
              <select value={separator} onChange={(e) => setSeparator(e.target.value)}>
                <option value=",">Comma (,)</option>
                <option value=";">Semicolon (;)</option>
                <option value="&#9;">Tab</option>
              </select>
            </label>
          </div>

          <label>
            Raw CSV Data
            <textarea
              style={{
                fontFamily: 'var(--ledger)',
                fontSize: '0.85rem',
                minHeight: '200px',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid var(--line)',
                width: '100%',
                resize: 'vertical'
              }}
              placeholder={`date,customer,type of item,quantity,single price,total price,paid amount,reminder\n9/3/2026,mubaric C001,flour 50kg,9,9900,89100,213000,closed\n12/3/2026,hayat ridda C002,flour 25kg,1,10000,10000,138000,cbe`}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <div>
            <button className="btn primary" onClick={handleParse}>Parse CSV Data</button>
          </div>
        </div>
      </section>

      {parsedData && (
        <section className="panel" style={{ marginTop: '20px' }}>
          <header className="panel-head">
            <h2>Parsed Data Preview</h2>
          </header>
          
          <div className="two-col" style={{ marginBottom: '20px' }}>
            <div style={{ padding: '12px', background: 'var(--surface)', borderRadius: '8px' }}>
              <strong>Clients to Create:</strong> {parsedData.clients.length}
              <ul style={{ maxHeight: '120px', overflowY: 'auto', paddingLeft: '20px', margin: '8px 0 0' }}>
                {parsedData.clients.map((c, idx) => (
                  <li key={idx} style={{ fontSize: '0.85rem' }}>{c.name} {c.code ? `(${c.code})` : ''}</li>
                ))}
              </ul>
            </div>
            
            <div style={{ padding: '12px', background: 'var(--surface)', borderRadius: '8px' }}>
              <strong>Financial Transactions:</strong>
              <div style={{ fontSize: '0.9rem', marginTop: '8px' }}>
                <div>Sales transactions: <strong>{parsedData.sales.length}</strong></div>
                <div>Payments: <strong>{parsedData.payments.length}</strong></div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn primary" onClick={handleImport} disabled={importMutation.isPending}>
              {importMutation.isPending ? 'Executing Import…' : 'Execute Import'}
            </button>
            <button className="btn ghost" onClick={() => setParsedData(null)}>Clear</button>
          </div>
        </section>
      )}
    </div>
  );
}
