<?php
require 'PHPMailer/Exception.php';
require 'PHPMailer/PHPMailer.php';
require 'PHPMailer/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

$mail = new PHPMailer(true);

try {
    $mail->isSMTP();
    $mail->Host       = 'smtp.gmail.com';
    $mail->SMTPAuth   = true;
    $mail->Username   = 'iyong-zamcedrickdapug@gmail.com'; 
    $mail->Password   = 'fzgx yerl fwhh awky'; 
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port       = 587;

    $mail->setFrom('iyong-zamcedrickdapug@gmail.com', 'H&S App');
    $mail->addAddress('recipient-zamcedrickdapug@gmail.com'); 

    $mail->isHTML(true);
    $mail->Subject = 'Verification Code';
    $mail->Body    = 'Ang iyong code ay: <b>' . rand(100000, 999999) . '</b>';

    $mail->send();
    echo 'Code sent successfully!';
} catch (Exception $e) {
    echo "Error: {$mail->ErrorInfo}";
}
?>