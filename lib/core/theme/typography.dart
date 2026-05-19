import 'package:flutter/material.dart';

TextStyle mono(double size,
    {Color color = Colors.white, FontWeight weight = FontWeight.normal}) {
  return TextStyle(
    fontFamily: 'monospace',
    fontSize: size,
    color: color,
    fontWeight: weight,
  );
}

TextStyle sans(double size,
    {Color color = Colors.white, FontWeight weight = FontWeight.normal}) {
  return TextStyle(
    fontFamily: 'sans-serif',
    fontSize: size,
    color: color,
    fontWeight: weight,
  );
}
