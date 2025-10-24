// src/QuestionList.jsx
import React, { useEffect, useState } from 'react'
import api from './services/api'

export default function QuestionList({ dersId }) {
  const [questions, setQuestions] = useState([])

  useEffect(() => { fetchQuestions() }, [dersId])

  async function fetchQuestions() {
    try {
      const { data } = await api.get('/api/sorular', { params: { dersId } })
      setQuestions(data || [])
    } catch (e) {
      console.error('Soru fetch hatası', e)
    }
  }

  return (
    <div>
      <h3>Sorular</h3>
      {questions.map(q => (
        <div key={q.id} style={{border:'1px solid #ddd', padding:10, marginBottom:8}}>
          <div><strong>{q.metin}</strong></div>
          {(q.secenekler || []).map(s => (
            <div key={s.id}>- {s.metin}</div>
          ))}
        </div>
      ))}
    </div>
  )
}
