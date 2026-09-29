"""
Generates an official IBM SPSS .sav binary dataset from ONEFOP CSV and Canonical Registry Metadata.
"""

import sys
import json
import os
import pandas as pd
import pyreadstat

def main():
    if len(sys.argv) < 4:
        print("Usage: python generate_spss_sav.py <csv_path> <meta_json_path> <output_sav_path>")
        sys.exit(1)

    csv_path = sys.argv[1]
    meta_json_path = sys.argv[2]
    out_sav_path = sys.argv[3]

    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"CSV file not found: {csv_path}")
    if not os.path.exists(meta_json_path):
        raise FileNotFoundError(f"Metadata JSON file not found: {meta_json_path}")

    with open(meta_json_path, 'r', encoding='utf-8') as f:
        variables = json.load(f)

    var_names = [v['variableName'] for v in variables]

    # Read CSV (first row is header/labels)
    # Using utf-8-sig to automatically strip any leading UTF-8 BOM
    try:
        df = pd.read_csv(
            csv_path,
            dtype=str,
            keep_default_na=False,
            encoding='utf-8-sig',
            header=0
        )
    except pd.errors.EmptyDataError:
        # Empty CSV with no rows, create empty DataFrame with correct columns
        df = pd.DataFrame(columns=var_names)

    # Ensure column names match analytical variable registry exactly
    if len(df.columns) == len(var_names):
        df.columns = var_names
    else:
        # Fallback if column count differs slightly
        col_slice = var_names[:len(df.columns)]
        df.columns = col_slice

    column_labels = {}
    variable_value_labels = {}
    missing_ranges = {}
    variable_format = {}

    for v in variables:
        name = v['variableName']
        if name not in df.columns:
            continue

        # Column label (SPSS supports labels up to 255 chars)
        label = v.get('labelFr') or v.get('labelEn') or name
        column_labels[name] = str(label)[:255]

        is_numeric = v.get('spssDataType') == 'NUMERIC'

        if is_numeric:
            # Convert column to float/int
            df[name] = pd.to_numeric(df[name], errors='coerce')
            missing_ranges[name] = [-99.0]
            variable_format[name] = 'F14.0' if 'payroll' in name.lower() or 'turnover' in name.lower() else 'F10.0'
        else:
            # Alphanumeric string column: enforce storage width to prevent ReadStat truncation
            df[name] = df[name].fillna('').astype(str)
            width = v.get('spssWidth') or 254
            variable_format[name] = f"A{min(max(int(width), 8), 254)}"

        # Value labels (codification)
        v_labels = v.get('valueLabels')
        if v_labels and isinstance(v_labels, dict) and len(v_labels) > 0:
            if is_numeric:
                numeric_val_labels = {}
                for code_str, lbl in v_labels.items():
                    try:
                        numeric_val_labels[float(code_str)] = str(lbl)[:120]
                    except ValueError:
                        pass
                if numeric_val_labels:
                    variable_value_labels[name] = numeric_val_labels
            else:
                # ReadStat C engine enforces ASCII keys for string value labels in SPSS files.
                # If keys are already French text phrases (non-ASCII), the data values are self-describing.
                if all(isinstance(k, str) and k.isascii() for k in v_labels.keys()):
                    str_val_labels = {str(k): str(val)[:120] for k, val in v_labels.items()}
                    variable_value_labels[name] = str_val_labels

    # Ensure parent output directory exists
    out_dir = os.path.dirname(os.path.abspath(out_sav_path))
    if out_dir and not os.path.exists(out_dir):
        os.makedirs(out_dir, exist_ok=True)

    # Write binary .sav file
    try:
        pyreadstat.write_sav(
            df,
            out_sav_path,
            file_label="CAM-LEAP / ONEFOP - Registre Analytique Canonique",
            column_labels=column_labels,
            variable_value_labels=variable_value_labels if variable_value_labels else None,
            missing_ranges=missing_ranges if missing_ranges else None,
            variable_format=variable_format if variable_format else None
        )
    except Exception as e:
        sys.stderr.write(f"Global write_sav failed: {e}\nIsolating failing column...\n")
        failing_cols = []
        for col in df.columns:
            single_df = df[[col]].copy()
            s_col_labels = {col: column_labels.get(col)}
            s_val_labels = {col: variable_value_labels.get(col)} if col in variable_value_labels else None
            s_missing = {col: missing_ranges.get(col)} if col in missing_ranges else None
            try:
                pyreadstat.write_sav(
                    single_df,
                    out_sav_path + ".tmp",
                    column_labels=s_col_labels,
                    variable_value_labels=s_val_labels,
                    missing_ranges=s_missing
                )
            except Exception as single_err:
                sys.stderr.write(f"Column '{col}' FAILED: {single_err}\n")
                sys.stderr.write(f"  Data sample: {single_df[col].tolist()[:5]}\n")
                if s_val_labels:
                    sys.stderr.write(f"  Val labels: {s_val_labels}\n")
                failing_cols.append(col)
        if os.path.exists(out_sav_path + ".tmp"):
            os.remove(out_sav_path + ".tmp")
        raise e

    print(f"SUCCESS: Generated {out_sav_path} ({os.path.getsize(out_sav_path)} bytes, {len(df)} rows, {len(df.columns)} columns)")

if __name__ == '__main__':
    main()
