import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { authActions } from "../../store/AuthSlice";
import { parseJwt } from "components/utils/ParseJwt";
import styled from "styled-components";

const BackGroundDiv = styled.div`
  background-color: black
  width: 100vw;
  height: 100vh;
  background-size: 100% 100%;

  text-align: center;
`;

const OauthRedirect = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // 서버로부터 userNo와 userRole이 담긴 token이 넘어온다.
  let token = useLocation().search.split("=")[1];
  let userNo = parseJwt(token).no;
  let userRole = parseJwt(token).role;

  console.log("현재 유저no", userNo);
  console.log("현재 유저role", userRole);

  useEffect(() => {
    // 받아온 이메일과 토큰을 redux에 저장
    if (userNo) {
      dispatch(authActions.addTokenUserNo({ token, userNo }));
      console.log("유저번호 및 토큰 저장 성공");
    }

    // userRole에 따라 request 구분
    if (userRole === "USER") {
      // 유저가 이미 가입되어있다면, 곧바로 회원정보 요청
      dispatch(authActions.getUserInfoStart(userNo));
      navigate("/game");
    } else if (userRole === "GUEST") {
      // 유저가 guest라면, 닉네임 등록 페이지로 이동
      navigate("/signup");
      window.location.reload();
    }
  }, [userNo]);

  return (
    <div>
      <BackGroundDiv>
        <h3>잠시만 기다려 주세요...</h3>
      </BackGroundDiv>
    </div>
  );
};

export default OauthRedirect;
