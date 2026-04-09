// lib/models/employee_adapter.dart
import 'package:hive/hive.dart';
import '../screens/dsmo/employee_list_screen.dart';

@HiveType(typeId: 0)
class EmployeeAdapter extends TypeAdapter<Employee> {
  @override
  final int typeId = 0;

  @override
  Employee read(BinaryReader reader) {
    return Employee(
      fullName: reader.readString(),
      gender: reader.readString(),
      age: reader.readInt(),
      nationality: reader.readString(),
      otherCountry: reader.readString(),
      diploma: reader.readString(),
      function: reader.readString(),
      seniority: reader.readInt(),
      salaryCategory: reader.readString(),
      salary: reader.readInt(),
    );
  }

  @override
  void write(BinaryWriter writer, Employee obj) {
    writer.writeString(obj.fullName);
    writer.writeString(obj.gender);
    writer.writeInt(obj.age);
    writer.writeString(obj.nationality);
    writer.writeString(obj.otherCountry ?? '');
    writer.writeString(obj.diploma);
    writer.writeString(obj.function);
    writer.writeInt(obj.seniority);
    writer.writeString(obj.salaryCategory);
    writer.writeInt(obj.salary);
  }
}
