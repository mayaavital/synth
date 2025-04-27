import React from "react";
import { StyleSheet, View } from "react-native";
import { WheelPicker } from "react-native-infinite-wheel-picker";

const ScrollPicker = () => {
  const initialData = [1, 2, 3, 4, 5, 6, 7, 8];
  const [selectedIndex, setSelectedIndex] = React.useState(3);

  return (
    <View style={styles.container}>
      <WheelPicker
        initialSelectedIndex={3}
        data={initialData}
        restElements={2}
        elementHeight={30}
        onChangeValue={(index, value) => {
          console.log(value);
          setSelectedIndex(index);
        }}
        selectedIndex={selectedIndex}
        containerStyle={styles.containerStyle}
        selectedLayoutStyle={styles.selectedLayoutStyle}
        elementTextStyle={styles.elementTextStyle}
      />
    </View>
  );
};

export default ScrollPicker;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "#fff",
    alignItems: "center",
  },
  selectedLayoutStyle: {
    backgroundColor: "#00000026",
    borderRadius: 2,
  },
  containerStyle: {
    backgroundColor: "#0000001a",
    width: 150,
  },
  elementTextStyle: {
    fontSize: 18,
  },
});
