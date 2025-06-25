import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import './App.css'

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [question, setQuestion] = useState("");
  const [report, setReport] = useState("");
  const [questionLoading, setQuestionLoading] = useState(false);
  const [questionError, setQuestionError] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyDeleteError, setHistoryDeleteError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalItem, setModalItem] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState(null);
  const [tag, setTag] = useState("");
  const [editTag, setEditTag] = useState("");
  const [tagFilterInput, setTagFilterInput] = useState("");
  const [tagFilterList, setTagFilterList] = useState([]);
  const [tagDropdown, setTagDropdown] = useState(false);
  const [tagDropdownIndex, setTagDropdownIndex] = useState(-1);
  const [popularTags, setPopularTags] = useState([]);
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);
  const [lastSuggestedTag, setLastSuggestedTag] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [isAndMode, setIsAndMode] = useState(true);
  const [serverHistory, setServerHistory] = useState([]);
  const [relatedTags, setRelatedTags] = useState([]);
  const [toastMsg, setToastMsg] = useState("");
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [tagSuggestionsLoading, setTagSuggestionsLoading] = useState(false);
  const [relatedQuestions, setRelatedQuestions] = useState([]);
  const [relatedQuestionsLoading, setRelatedQuestionsLoading] = useState(false);
  const [relatedQuestionsError, setRelatedQuestionsError] = useState("");
  const relatedQDebounce = useRef();
  const [lastRelatedQ, setLastRelatedQ] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiAnswerLoading, setAiAnswerLoading] = useState(false);
  const [aiAnswerError, setAiAnswerError] = useState("");
  const aiAnswerRef = useRef(null);
  const [feedbackState, setFeedbackState] = useState({});
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [lastQuestionId, setLastQuestionId] = useState(null);
  const [showFeedbackOnly, setShowFeedbackOnly] = useState(false);
  const [showRecentOnly, setShowRecentOnly] = useState(false);
  const [tagFilter, setTagFilter] = useState("");

  const token = localStorage.getItem("token");
  const API_BASE_URL = import.meta.env.VITE_API_URL;

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username: email, password }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "로그인 실패");
      }
      const data = await response.json();
      localStorage.setItem("token", data.access_token);
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuestion = async (e) => {
    e.preventDefault();
    setQuestionLoading(true);
    setQuestionError("");
    setReport("");
    setAiAnswer("");
    setAiAnswerError("");
    setAiAnswerLoading(false);
    try {
      if (!token) {
        setQuestionError("로그인이 필요합니다");
        return;
      }
      const response = await fetch(`${API_BASE_URL}/question`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question, tag: tag || undefined }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "질문 처리 실패");
      }
      const data = await response.json();
      setReport(data.report);
      // 질문 저장 후 AI 답변 생성 요청
      setAiAnswerLoading(true);
      setAiAnswerError("");
      setAiAnswer("");
      // fetch 최신 history에서 id 찾기
      const histRes = await fetch(`${API_BASE_URL}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!histRes.ok) throw new Error("질문 기록 조회 실패");
      const histData = await histRes.json();
      const last = histData && histData.length > 0 ? histData[0] : null;
      if (!last || !last.id) throw new Error("질문 ID를 찾을 수 없습니다");
      // 이미 report_text가 있으면 호출 생략
      if (last.report) {
        setAiAnswer(last.report);
        setAiAnswerLoading(false);
        // Fetch user's feedback for this question (optional, for initial state)
        try {
          const feedbackRes = await fetch(`${API_BASE_URL}/answer-feedback-status?question_id=${last.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (feedbackRes.ok) {
            const feedbackData = await feedbackRes.json();
            if (feedbackData.feedback_type) {
              setFeedbackState((prev) => ({ ...prev, [last.id]: feedbackData.feedback_type }));
            }
          }
        } catch { /* ignore error */ }
        setLastQuestionId(last.id);
        return;
      }
      // AI 답변 생성 API 호출
      const aiRes = await fetch(`${API_BASE_URL}/questions/${last.id}/suggest-answer`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!aiRes.ok) throw new Error("AI 답변 생성 실패");
      const aiData = await aiRes.json();
      setAiAnswer(aiData.answer_text || "");
      setAiAnswerLoading(false);
      // 자동 스크롤
      setTimeout(() => {
        if (aiAnswerRef.current) aiAnswerRef.current.scrollIntoView({ behavior: "smooth" });
      }, 200);
      // Fetch user's feedback for this question (optional, for initial state)
      try {
        const feedbackRes = await fetch(`${API_BASE_URL}/answer-feedback-status?question_id=${last.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (feedbackRes.ok) {
          const feedbackData = await feedbackRes.json();
          if (feedbackData.feedback_type) {
            setFeedbackState((prev) => ({ ...prev, [last.id]: feedbackData.feedback_type }));
          }
        }
      } catch { /* ignore error */ }
      setLastQuestionId(last.id);
    } catch (err) {
      setQuestionError(err.message);
      setAiAnswerError(err.message);
      setAiAnswerLoading(false);
    } finally {
      setQuestionLoading(false);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    setHistoryError("");
    setHistoryDeleteError("");
    try {
      if (!token) {
        setHistoryError("로그인이 필요합니다");
        setHistory([]);
        return;
      }
      const response = await fetch(`${API_BASE_URL}/history`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "기록 불러오기 실패");
      }
      const data = await response.json();
      setHistory(data);
    } catch (err) {
      setHistoryError(err.message);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDeleteHistory = async (idx) => {
    setHistoryDeleteError("");
    const item = history[idx];
    if (!item || !item.id) {
      setHistoryDeleteError("삭제할 항목을 찾을 수 없습니다.");
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/history/${item.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "삭제 실패");
      }
      // 성공 시 리스트에서 제거
      setHistory((prev) => prev.filter((_, i) => i !== idx));
    } catch (err) {
      setHistoryDeleteError(err.message);
    }
  };

  const handleShowHistory = () => {
    setShowHistory(true);
    fetchHistory();
  };

  const handleShowQuestion = () => {
    setShowHistory(false);
    setReport("");
    setQuestionError("");
  };

  const handleOpenModal = (item) => {
    setModalItem(item);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setModalItem(null);
  };

  const handleEditClick = () => {
    setEditValue(modalItem.question);
    setEditTag(modalItem.tag || "");
    setEditMode(true);
    setEditError("");
  };

  const handleEditCancel = () => {
    setEditMode(false);
    setEditError("");
  };

  const handleEditSave = async () => {
    setEditLoading(true);
    setEditError("");
    try {
      const response = await fetch(`${API_BASE_URL}/history/${modalItem.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question: editValue, tag: editTag || undefined }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "수정 실패");
      }
      const data = await response.json();
      setModalItem((prev) => ({ ...prev, question: data.question, report: data.report, tag: data.tag }));
      setHistory((prev) => prev.map((item) => item.id === modalItem.id ? { ...item, question: data.question, report: data.report, tag: data.tag } : item));
      setEditMode(false);
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteClick = (idx) => {
    setConfirmDeleteIdx(idx);
  };

  const handleDeleteCancel = () => {
    setConfirmDeleteIdx(null);
  };

  const handleDeleteConfirm = async () => {
    if (confirmDeleteIdx === null) return;
    await handleDeleteHistory(confirmDeleteIdx);
    setConfirmDeleteIdx(null);
  };

  // 로그아웃 핸들러
  const handleLogout = () => {
    localStorage.removeItem("token");
    setSuccess(false);
    setReport("");
    setQuestion("");
    setShowHistory(false);
    setHistory([]);
    setError("");
    setQuestionError("");
    setHistoryError("");
    setHistoryDeleteError("");
    // 강제 리렌더링을 위해 상태 변경
    window.location.reload();
  };

  // 다중 태그 필터 추가/삭제
  const handleTagFilterInput = (e) => {
    setTagFilterInput(e.target.value);
    setTagDropdown(true);
  };

  // 태그 추가 시 중복 제거 및 가나다순 정렬 + 토스트 메시지
  const addTagToFilter = (newTag, showToast = false) => {
    const lowerTag = newTag.toLowerCase();
    let tags = [...tagFilterList.map(t => t.toLowerCase()), lowerTag];
    tags = [...new Set(tags)];
    tags.sort((a, b) => a.localeCompare(b));
    setTagFilterList(tags);
    if (showToast) {
      setToastMsg(`#${newTag} 태그가 추가되었습니다.`);
      setTimeout(() => setToastMsg(""), 1500);
    }
  };

  // 태그 필터 input 키보드 UX 개선
  const handleTagFilterKeyDown = (e) => {
    if ((e.key === "Enter" || e.key === "," || e.key === "Tab") && tagFilterInput.trim()) {
      e.preventDefault();
      if (tagDropdown && tagDropdownIndex >= 0 && tagDropdownIndex < tagSuggestions.length) {
        const selected = tagSuggestions[tagDropdownIndex];
        addTagToFilter(selected);
        setTagFilterInput("");
        setTagDropdown(false);
        setTagDropdownIndex(-1);
        return;
      }
      addTagToFilter(tagFilterInput.trim());
      setTagFilterInput("");
      setTagDropdown(false);
      setTagDropdownIndex(-1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setTagDropdown(true);
      setTagDropdownIndex((prev) => Math.min((prev < 0 ? 0 : prev + 1), tagSuggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setTagDropdown(true);
      setTagDropdownIndex((prev) => Math.max((prev <= 0 ? 0 : prev - 1), 0));
    } else if (e.key === "Escape") {
      setTagDropdown(false);
      setTagDropdownIndex(-1);
    }
  };

  const handleTagFilterRemove = (tag) => {
    setTagFilterList(tagFilterList.filter((t) => t !== tag));
  };

  // 태그+검색 동시 필터링 (서버 연동)
  useEffect(() => {
    if (tagFilterList.length === 0) {
      setServerHistory(history);
      return;
    }
    const endpoint = isAndMode ? '/questions' : '/questions-or';
    const tagParam = tagFilterList.join(',');
    fetch(`${API_BASE_URL}${endpoint}?tag=${encodeURIComponent(tagParam)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setServerHistory(data))
      .catch(() => setServerHistory([]));
  }, [tagFilterList, isAndMode, token, history]);

  // 최종 필터: 서버 결과 + 검색어
  const filteredHistory = serverHistory.filter((item) => {
    const searchMatch = searchKeyword.trim()
      ? (item.question || "").toLowerCase().includes(searchKeyword.trim().toLowerCase())
      : true;
    return searchMatch;
  });

  // 인기 태그 불러오기
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE_URL}/popular-tags`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setPopularTags(data))
      .catch(() => setPopularTags([]));
  }, [token]);

  // 태그 자동완성 fetch (서버 기반, 1자 이상 입력 시)
  useEffect(() => {
    if (tagFilterInput.length < 1) {
      setTagSuggestions([]);
      setTagSuggestionsLoading(false);
      return;
    }
    setTagSuggestionsLoading(true);
    fetch(`${API_BASE_URL}/search-tags?q=${encodeURIComponent(tagFilterInput)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        // 중복/최근 태그 제외, 최대 20개
        const exclude = tagFilterList.map(t => t.toLowerCase());
        setTagSuggestions(data.filter(t => !exclude.includes(t.toLowerCase())).slice(0, 20));
        setTagSuggestionsLoading(false);
      })
      .catch(() => {
        setTagSuggestions([]);
        setTagSuggestionsLoading(false);
      });
  }, [tagFilterInput, tagFilterList, token]);

  // 추천 질문 실시간 fetch (단일 태그 기준)
  useEffect(() => {
    const mainTag = tag || (tagFilterList.length === 1 ? tagFilterList[0] : "");
    if (!mainTag) {
      setSuggestedQuestions([]);
      setLastSuggestedTag("");
      return;
    }
    if (mainTag === lastSuggestedTag) return;
    setLastSuggestedTag(mainTag);
    fetch(`${API_BASE_URL}/suggest-question?tag=${encodeURIComponent(mainTag)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setSuggestedQuestions(data.suggested_questions || []))
      .catch(() => setSuggestedQuestions([]));
  }, [tag, tagFilterList, token, lastSuggestedTag]);

  // 연관 태그 추천 fetch
  useEffect(() => {
    if (tagFilterList.length === 0) {
      setRelatedTags([]);
      return;
    }
    fetch(`${API_BASE_URL}/related-tags?tag=${encodeURIComponent(tagFilterList.join(","))}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setRelatedTags(data.related_tags || []))
      .catch(() => setRelatedTags([]));
  }, [tagFilterList, token]);

  // 질문 입력 시 유사 질문 추천 (debounce)
  useEffect(() => {
    if (question.length < 2) {
      setRelatedQuestions([]);
      setRelatedQuestionsLoading(false);
      setRelatedQuestionsError("");
      setLastRelatedQ("");
      return;
    }
    if (question === lastRelatedQ) return;
    setRelatedQuestionsLoading(true);
    setRelatedQuestionsError("");
    if (relatedQDebounce.current) clearTimeout(relatedQDebounce.current);
    relatedQDebounce.current = setTimeout(() => {
      fetch(`${API_BASE_URL}/related-questions?question_text=${encodeURIComponent(question)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          setRelatedQuestions(data);
          setRelatedQuestionsLoading(false);
          setLastRelatedQ(question);
        })
        .catch(() => {
          setRelatedQuestions([]);
          setRelatedQuestionsLoading(false);
          setRelatedQuestionsError("관련 질문을 불러오지 못했습니다.");
        });
    }, 500);
    // eslint-disable-next-line
  }, [question, token]);

  const handleFeedback = async (type) => {
    if (!report || !lastQuestionId || feedbackLoading || feedbackState[lastQuestionId]) return;
    setFeedbackLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/answer-feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question_id: lastQuestionId, feedback_type: type }),
      });
      if (!res.ok) throw new Error('피드백 저장에 실패했습니다');
      setFeedbackState((prev) => ({ ...prev, [lastQuestionId]: type }));
      setToastMsg('피드백이 저장되었습니다');
      setTimeout(() => setToastMsg(''), 1500);
    } catch (err) {
      setToastMsg(err.message || '피드백 저장에 실패했습니다');
      setTimeout(() => setToastMsg(''), 1500);
    } finally {
      setFeedbackLoading(false);
    }
  };

  // 추천 질문 리스트 필터링
  let filtered = filteredHistory;
  if (showFeedbackOnly) {
    filtered = filtered.filter(item => item.feedback_score && item.feedback_score > 0);
  }
  if (showRecentOnly) {
    filtered = filtered.slice().sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  }
  if (tagFilter) {
    filtered = filtered.filter(item => item.tag && item.tag.toLowerCase() === tagFilter.toLowerCase());
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <div className="relative p-8 w-full max-w-md bg-white rounded-lg shadow-md">
        <h2 className="mb-6 text-2xl font-bold text-center">LucidTalk</h2>
        {token || success ? (
          <button
            className="absolute top-4 right-4 px-3 py-1 text-sm font-semibold text-gray-400 rounded border border-gray-200 transition hover:text-red-500"
            onClick={handleLogout}
            title="로그아웃"
          >
            로그아웃
          </button>
        ) : null}
        {!token && !success ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block mb-1 text-gray-700">이메일</label>
              <input
                type="email"
                className="px-3 py-2 w-full rounded border focus:outline-none focus:ring focus:border-blue-300"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block mb-1 text-gray-700">비밀번호</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="px-3 py-2 pr-10 w-full rounded border focus:outline-none focus:ring focus:border-blue-300"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="flex absolute inset-y-0 right-2 items-center text-gray-400"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>
            {error && <div className="text-sm text-red-500">{error}</div>}
            <button
              type="submit"
              className="py-2 w-full font-semibold text-white bg-blue-600 rounded transition hover:bg-blue-700 disabled:opacity-50"
              disabled={!email || !password || loading}
            >
              {loading ? "로그인 중..." : "로그인"}
            </button>
            <div className="flex flex-col items-center mt-4 space-y-2">
              <button
                type="button"
                className="flex justify-center items-center py-2 w-full font-semibold text-gray-700 bg-gray-100 rounded border border-gray-200 transition hover:bg-gray-200"
                disabled
              >
                <span className="mr-2">🔵</span> Google로 로그인 (준비중)
              </button>
              <button
                type="button"
                className="flex justify-center items-center py-2 w-full font-semibold text-gray-700 bg-gray-100 rounded border border-gray-200 transition hover:bg-gray-200"
                disabled
              >
                <span className="mr-2">🟦</span> Facebook으로 로그인 (준비중)
              </button>
            </div>
            <div className="flex justify-between mt-6 text-sm text-gray-500">
              <a href="#" className="hover:underline">회원가입</a>
              <a href="#" className="hover:underline">아이디 찾기</a>
              <a href="#" className="hover:underline">비밀번호 찾기</a>
            </div>
          </form>
        ) : (
          <>
            <div className="flex justify-between mb-4">
              <button
                className={`px-4 py-2 rounded font-semibold border transition ${!showHistory ? "text-white bg-blue-600 border-blue-600" : "text-blue-600 bg-white border-blue-600"}`}
                onClick={handleShowQuestion}
              >
                질문하기
              </button>
              <button
                className={`px-4 py-2 rounded font-semibold border transition ${showHistory ? "text-white bg-blue-600 border-blue-600" : "text-blue-600 bg-white border-blue-600"}`}
                onClick={handleShowHistory}
              >
                기록 보기
              </button>
            </div>
            {showHistory ? (
              <div>
                {/* 검색 + 태그 필터 입력 UI */}
                <div className="flex flex-wrap gap-2 items-center mb-4">
                  <input
                    type="text"
                    className="px-3 py-1 mb-1 text-sm rounded border focus:outline-none focus:ring focus:border-blue-300"
                    placeholder="질문 검색..."
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    style={{ minWidth: 160 }}
                  />
                  {tagFilterList.map((tag) => (
                    <span key={tag} className="flex items-center bg-gray-200 text-gray-600 rounded-full px-2 py-0.5 text-xs mr-1 mb-1">
                      #{tag}
                      <button
                        className="ml-1 text-gray-400 hover:text-red-500 focus:outline-none"
                        onClick={() => handleTagFilterRemove(tag)}
                        tabIndex={-1}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <div className="relative">
                    {/* 인기 태그 추천 */}
                    {(tagDropdown && (!tagFilterInput || tagSuggestions.length === 0)) && popularTags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {popularTags.map((t) => (
                          <button
                            key={t}
                            type="button"
                            className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-300 text-xs font-semibold shadow-sm hover:bg-yellow-200 transition"
                            onMouseDown={() => {
                              addTagToFilter(t);
                              setTagFilterInput("");
                              setTagDropdown(false);
                              setTagDropdownIndex(-1);
                            }}
                          >
                            # {t}
                          </button>
                        ))}
                      </div>
                    )}
                    <input
                      type="text"
                      className="px-3 py-1 text-sm rounded border focus:outline-none focus:ring focus:border-blue-300"
                      placeholder="태그로 필터 (ex: 운세)"
                      value={tagFilterInput}
                      onChange={handleTagFilterInput}
                      onKeyDown={handleTagFilterKeyDown}
                      onFocus={() => setTagDropdown(true)}
                      onBlur={() => setTimeout(() => { setTagDropdown(false); setTagDropdownIndex(-1); }, 150)}
                      autoComplete="off"
                    />
                    {tagDropdown && (
                      <div className="overflow-y-auto absolute right-0 left-0 z-10 max-h-32 bg-white rounded border border-gray-200 shadow">
                        {tagSuggestionsLoading ? (
                          <div className="px-3 py-2 text-sm text-gray-400">로딩 중...</div>
                        ) : tagSuggestions.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-gray-400">추천 태그가 없습니다</div>
                        ) : tagSuggestions.map((t, i) => (
                          <div
                            key={t}
                            className={`px-3 py-1 text-sm cursor-pointer ${i === tagDropdownIndex ? "bg-blue-100 text-blue-800" : "text-gray-700 hover:bg-blue-50"}`}
                            onMouseDown={() => {
                              addTagToFilter(t);
                              setTagFilterInput("");
                              setTagDropdown(false);
                              setTagDropdownIndex(-1);
                            }}
                            onMouseEnter={() => setTagDropdownIndex(i)}
                          >
                            {t}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {tagFilterList.length > 0 && (
                    <button
                      className="px-2 py-1 mb-1 ml-1 text-xs bg-gray-200 rounded hover:bg-gray-300"
                      onClick={() => { setTagFilterList([]); setTagFilterInput(""); }}
                    >
                      전체 보기
                    </button>
                  )}
                </div>
                {/* AND/OR 토글 UI */}
                <div className="flex gap-2 items-center mb-2">
                  <span className="text-xs text-gray-500">태그 조건:</span>
                  <button
                    className={`px-2 py-1 rounded-l border text-xs font-semibold ${isAndMode ? 'text-white bg-blue-600 border-blue-600' : 'text-blue-600 bg-white border-blue-600'}`}
                    onClick={() => setIsAndMode(true)}
                  >
                    모두 포함(AND)
                  </button>
                  <button
                    className={`px-2 py-1 rounded-r border text-xs font-semibold ${!isAndMode ? 'text-white bg-blue-600 border-blue-600' : 'text-blue-600 bg-white border-blue-600'}`}
                    onClick={() => setIsAndMode(false)}
                  >
                    하나 이상 포함(OR)
                  </button>
                </div>
                {/* 연관 태그 추천 UI */}
                {tagFilterList.length > 0 && relatedTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 items-center mb-2">
                    <span className="text-xs text-gray-500">연관 태그:</span>
                    {relatedTags.filter(t => !tagFilterList.includes(t.toLowerCase())).map((t) => (
                      <button
                        key={t}
                        type="button"
                        className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-300 text-xs font-semibold shadow-sm hover:bg-green-200 transition"
                        onClick={() => addTagToFilter(t, true)}
                      >
                        # {t}
                      </button>
                    ))}
                  </div>
                )}
                {/* 리스트 상단 필터 버튼 UI */}
                <div className="flex flex-wrap gap-2 mb-2">
                  <button
                    className={`px-2 py-1 rounded border text-xs font-semibold ${showFeedbackOnly ? 'text-white bg-blue-600 border-blue-600' : 'text-blue-600 bg-white border-blue-600'}`}
                    onClick={() => setShowFeedbackOnly(v => !v)}
                  >
                    피드백 있는 질문만 보기
                  </button>
                  <button
                    className={`px-2 py-1 rounded border text-xs font-semibold ${showRecentOnly ? 'text-white bg-blue-600 border-blue-600' : 'text-blue-600 bg-white border-blue-600'}`}
                    onClick={() => setShowRecentOnly(v => !v)}
                  >
                    최신순
                  </button>
                  <input
                    type="text"
                    className="px-2 py-1 text-xs rounded border"
                    placeholder="태그로 필터"
                    value={tagFilter}
                    onChange={e => setTagFilter(e.target.value)}
                    style={{ minWidth: 80 }}
                  />
                </div>
                {historyLoading ? (
                  <div className="text-center text-gray-500">기록 불러오는 중...</div>
                ) : historyError ? (
                  <div className="text-center text-red-500">{historyError}</div>
                ) : filtered.length === 0 ? (
                  <div className="text-center text-gray-400">
                    {tagFilterList.length > 0
                      ? isAndMode
                        ? "선택한 모든 태그에 일치하는 질문이 없습니다."
                        : "선택한 태그 중 하나라도 포함된 질문이 없습니다."
                      : "질문 기록이 없습니다."}
                  </div>
                ) : (
                  <div className="overflow-y-auto space-y-4 max-h-96">
                    {historyDeleteError && (
                      <div className="mb-2 text-center text-red-500">{historyDeleteError}</div>
                    )}
                    {filtered.map((item, idx) => (
                      <div key={idx} className="flex relative flex-col justify-between p-4 bg-blue-50 rounded border border-blue-200 shadow sm:flex-row sm:items-center">
                        <div className="flex-1 min-w-0">
                          <div className="mb-1 font-bold text-gray-800 truncate">Q. {item.question}</div>
                          {item.tag && (
                            <div className="inline-block px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded mb-1 mr-2">#{item.tag}</div>
                          )}
                          <div className="text-sm text-gray-600">AI 리포트</div>
                          <div className="mt-1 text-gray-700 break-words">{item.report}</div>
                          {/* 추천 근거 badge/tooltip */}
                          {(item["추천근거"] || item.reason || (item.meta && item.meta.reason)) && (
                            <span
                              className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 mt-2 cursor-help"
                              title={item["추천근거"] || item.reason || (item.meta && item.meta.reason)}
                              style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            >
                              {item["추천근거"]?.includes("유용") ? "🧠" : "🔍"}
                              <span className="truncate">{(item["추천근거"] || item.reason || (item.meta && item.meta.reason)).replace('자주 유용하다고 평가된 태그', '유용함 피드백 다수').replace('최근 유사 질문에서 유용하다고 선택된 예시', '최근 유사 태그에서 자주 등장')}</span>
                            </span>
                          )}
                        </div>
                        {/* 추천 점수 progress bar/아이콘 */}
                        <div className="flex flex-col items-end ml-4 mt-2 sm:mt-0 min-w-[80px]">
                          <div className="flex gap-1 items-center text-xs text-gray-500">
                            <span className="text-lg font-bold text-blue-600">{item.feedback_score ?? 0}</span>
                            <span>점</span>
                          </div>
                          <div className="mt-1 w-16 h-2 bg-gray-200 rounded">
                            <div
                              className="h-2 bg-blue-400 rounded"
                              style={{ width: `${Math.min(100, (item.feedback_score ?? 0) * 10)}%` }}
                            />
                          </div>
                        </div>
                        <button
                          className="absolute right-2 bottom-2 px-2 py-1 text-xs text-blue-600 bg-white bg-opacity-80 rounded hover:underline"
                          onClick={() => handleOpenModal(item)}
                        >
                          상세 보기
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {/* 삭제 확인 모달 */}
                {confirmDeleteIdx !== null && (
                  <div className="flex fixed inset-0 z-50 justify-center items-center bg-black bg-opacity-30">
                    <div className="relative p-6 w-full max-w-xs bg-white rounded-lg shadow-lg">
                      <div className="mb-4 text-lg font-semibold text-center">정말 삭제하시겠습니까?</div>
                      <div className="flex justify-end space-x-2">
                        <button
                          className="px-3 py-1 text-gray-600 rounded border hover:bg-gray-100"
                          onClick={handleDeleteCancel}
                        >
                          취소
                        </button>
                        <button
                          className="px-3 py-1 font-semibold text-white bg-red-600 rounded hover:bg-red-700"
                          onClick={handleDeleteConfirm}
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {/* 상세 모달 */}
                {modalOpen && modalItem && (
                  <div className="flex fixed inset-0 z-50 justify-center items-center bg-black bg-opacity-30">
                    <div className="relative p-6 w-full max-w-md bg-white rounded-lg shadow-lg">
                      <button
                        className="absolute top-2 right-2 text-lg text-gray-400 hover:text-red-500"
                        onClick={handleCloseModal}
                        title="닫기"
                      >
                        ×
                      </button>
                      <div className="mb-4">
                        <div className="mb-1 text-sm text-gray-500">질문</div>
                        {editMode ? (
                          <>
                            <textarea
                              className="p-2 mb-2 w-full rounded border"
                              rows={2}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              disabled={editLoading}
                            />
                            <input
                              type="text"
                              className="p-2 mb-2 w-full rounded border"
                              value={editTag}
                              onChange={(e) => setEditTag(e.target.value)}
                              placeholder="태그 (선택)"
                              disabled={editLoading}
                            />
                          </>
                        ) : (
                          <>
                            <div className="font-bold text-gray-800 break-words">{modalItem.question}</div>
                            {modalItem.tag && (
                              <div className="inline-block px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded mb-1 mr-2">#{modalItem.tag}</div>
                            )}
                          </>
                        )}
                      </div>
                      <div>
                        <div className="mb-1 text-sm text-gray-500">AI 리포트</div>
                        <div className="text-gray-700 break-words">{modalItem.report}</div>
                      </div>
                      {editError && <div className="mt-2 text-sm text-red-500">{editError}</div>}
                      <div className="flex justify-end mt-6 space-x-2">
                        {editMode ? (
                          <>
                            <button
                              className="px-3 py-1 text-gray-600 rounded border hover:bg-gray-100"
                              onClick={handleEditCancel}
                              disabled={editLoading}
                            >
                              취소
                            </button>
                            <button
                              className="px-3 py-1 font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                              onClick={handleEditSave}
                              disabled={editLoading || !editValue.trim()}
                            >
                              {editLoading ? "저장 중..." : "저장"}
                            </button>
                          </>
                        ) : (
                          <button
                            className="px-3 py-1 text-blue-600 rounded border hover:bg-blue-50"
                            onClick={handleEditClick}
                          >
                            질문 수정
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleQuestion} className="space-y-4">
                <div>
                  <label className="block mb-1 text-gray-700">질문을 입력하세요</label>
                  <input
                    type="text"
                    className="px-3 py-2 w-full rounded border focus:outline-none focus:ring focus:border-blue-300"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    required
                    placeholder="오늘의 운세 알려줘"
                  />
                  {/* 추천 질문 리스트 */}
                  {suggestedQuestions.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {suggestedQuestions.map((q) => (
                        <div
                          key={q}
                          className="px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded border border-gray-200 transition cursor-pointer hover:bg-blue-100"
                          onClick={() => setQuestion(q)}
                        >
                          {q}
                        </div>
                      ))}
                    </div>
                  )}
                  {/* 유사 질문 리스트 */}
                  <div className="mt-2">
                    {relatedQuestionsLoading ? (
                      <div className="text-sm text-gray-400">관련 질문을 불러오는 중...</div>
                    ) : relatedQuestionsError ? (
                      <div className="text-sm text-red-500">{relatedQuestionsError}</div>
                    ) : question.length >= 2 && relatedQuestions.length === 0 ? (
                      <div className="text-sm text-gray-400">관련 질문이 없습니다</div>
                    ) : relatedQuestions.length > 0 ? (
                      <div className="space-y-1">
                        {relatedQuestions.map((item) => (
                          <a
                            key={item.id}
                            href={`#/question/${item.id}`}
                            className="block px-3 py-2 bg-yellow-50 rounded border border-yellow-200 transition hover:bg-yellow-100"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <div className="font-semibold text-gray-800 text-sm mb-0.5">{item.question_text}</div>
                            <div className="text-xs text-gray-500 mb-0.5">{item.created_at ? new Date(item.created_at).toLocaleDateString() : ""}</div>
                            {item.tag && (
                              <span className="inline-block px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">#{item.tag}</span>
                            )}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div>
                  <label className="block mb-1 text-gray-700">태그 (선택)</label>
                  <div className="relative">
                    <input
                      type="text"
                      className="px-3 py-2 w-full rounded border focus:outline-none focus:ring focus:border-blue-300"
                      value={tag}
                      onChange={(e) => {
                        setTag(e.target.value);
                        setTagDropdown(true);
                      }}
                      placeholder="ex) 운세"
                      onFocus={() => setTagDropdown(true)}
                      onBlur={() => setTimeout(() => setTagDropdown(false), 150)}
                      autoComplete="off"
                    />
                    {tagDropdown && tagSuggestions.length > 0 && (
                      <div className="overflow-y-auto absolute right-0 left-0 z-10 max-h-32 bg-white rounded border border-gray-200 shadow">
                        {tagSuggestions.map((t) => (
                          <div
                            key={t}
                            className="px-3 py-1 text-sm text-gray-700 cursor-pointer hover:bg-blue-100"
                            onMouseDown={() => {
                              setTag(t);
                              setTagDropdown(false);
                            }}
                          >
                            {t}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {questionError && <div className="text-sm text-red-500">{questionError}</div>}
                <button
                  type="submit"
                  className="py-2 w-full font-semibold text-white bg-green-600 rounded transition hover:bg-green-700 disabled:opacity-50"
                  disabled={!question || questionLoading}
                >
                  {questionLoading ? "질문 처리 중..." : "질문하기"}
                </button>
                {report && (
                  <div className="p-4 mt-6 text-center bg-blue-50 rounded border border-blue-200 shadow">
                    <div className="mb-2 text-lg font-semibold">AI 리포트</div>
                    <div className="text-gray-700">{report}</div>
                    {/* AI 답변 영역 */}
                    <div ref={aiAnswerRef} className="mt-4">
                      {aiAnswerLoading ? (
                        <div className="flex gap-2 justify-center items-center text-blue-500"><span className="animate-spin">🔄</span>AI가 답변을 생성 중입니다...</div>
                      ) : aiAnswerError ? (
                        <div className="text-red-500">답변 생성에 실패했어요 <button className="text-blue-600 underline" onClick={handleQuestion}>재시도</button></div>
                      ) : aiAnswer ? (
                        <>
                          <div className="p-3 mt-2 text-left text-gray-800 bg-white rounded border border-gray-200">{aiAnswer}</div>
                          {/* 피드백 버튼 */}
                          <div className="flex gap-4 justify-center mt-4">
                            <button
                              className={`px-4 py-2 rounded-full border flex items-center gap-2 text-lg font-semibold transition ${feedbackState[lastQuestionId]==='useful' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-white text-gray-700 border-gray-300 hover:bg-green-50'}`}
                              onClick={() => handleFeedback('useful')}
                              disabled={feedbackLoading || !!feedbackState[lastQuestionId]}
                            >
                              👍 유용해요
                            </button>
                            <button
                              className={`px-4 py-2 rounded-full border flex items-center gap-2 text-lg font-semibold transition ${feedbackState[lastQuestionId]==='not_useful' ? 'bg-red-100 text-red-700 border-red-300' : 'bg-white text-gray-700 border-gray-300 hover:bg-red-50'}`}
                              onClick={() => handleFeedback('not_useful')}
                              disabled={feedbackLoading || !!feedbackState[lastQuestionId]}
                            >
                              👎 별로예요
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="text-gray-400">AI가 적절한 답변을 찾지 못했어요</div>
                      )}
                    </div>
                  </div>
                )}
              </form>
            )}
          </>
        )}
        {/* 토스트 메시지 */}
        {toastMsg && (
          <div className="fixed top-6 left-1/2 z-50 px-4 py-2 text-white bg-black bg-opacity-80 rounded shadow-lg transform -translate-x-1/2 animate-fade-in">
            {toastMsg}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
