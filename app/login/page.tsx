"use client"
import "./login-page.css"
import {HOME_ROUTE, REGISTER_ROUTE} from "../constants/routes";
import Link from "next/link";
import InputField from "../../components/InputField/InputField";
import SubmitButton from "../../components/SubmitButton/SubmitButton";
import {useForm} from "react-hook-form";
import {yupResolver} from "@hookform/resolvers/yup";
import {loginSchema} from "../validationSchema/auth";
import {auth, db} from "../services/Firebase.js"
import {signInWithEmailAndPassword} from "@firebase/auth";
import {useRouter} from "next/navigation";
import {memo, useCallback} from "react";
import {doc, DocumentData, setDoc} from "firebase/firestore";

interface UserLogin {
    email: string,
    password: string
}

const Login = () => {
    const {handleSubmit, register, formState: {errors}, reset} = useForm({
        resolver: yupResolver(loginSchema),
    })

    const router = useRouter();

    const onSubmit = useCallback((userData: UserLogin) => {
        signInWithEmailAndPassword(auth, userData.email, userData.password).then(async (response) => {
            const userid = response.user.uid;
            setTimeout(() => {
                router.push(HOME_ROUTE);
            }, 1000);
            reset();
            try {
                await setDoc(doc(db, "users", userid), {
                    email: userData.email,
                    name: "",
                    iconURL: ""
                } as DocumentData);
            } catch (errors){
                console.log('errors adding document', JSON.stringify(errors, null, 2));
            }
        }).catch((errors) => {
            alert("что-то пошло не так")
            console.log('errors', JSON.stringify(errors, null, 2));
        })
    }, [reset, router])

    return (
        <div>
            <div>
                <span>Вход в аккаунт</span>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <InputField register={register} error={errors.email} type="text" placeholder=" Введите email..."
                                name="email" label="Email"/>
                    <InputField register={register} error={errors.password} type="password"
                                placeholder=" Введите пароль..." name="password"
                                label="Пароль"/>
                    <SubmitButton label="Войти"/>
                    <>
                        <span>Нет аккаунта? </span>
                        <Link href={REGISTER_ROUTE}>
                            <span>Зарегестрироваться</span>
                        </Link>
                    </>
                </form>
            </div>
        </div>
    )
}
export default memo(Login);
